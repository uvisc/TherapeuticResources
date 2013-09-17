<?php
use Respect\Validation\Validator as v;

/**
 * create the Slim application
 */
$app = new \Slim\Slim(
    array(
        'debug'=>false,
        'auth' => false,
        'templates.path' => __DIR__ . '/../templates',
        'admin.url' => '/admin' // url used to log in as admin
    )
);

// load the settings file. In case the file doesn't exist redirect to the install page.
if(file_exists(__DIR__ . '/../config/settings.yml')) {
    $settings = \Symfony\Component\Yaml\Yaml::parse(file_get_contents(__DIR__ . '/../config/settings.yml'));
    if(isset($settings['admin_url']) && $settings['admin_url'] != null) {
        $app->config('admin.url', $settings['admin_url']);
    }
    if(!isset($settings['date_format']) || $settings['date_format'] == null) {
        $settings['date_format'] = 'm/d/Y';
    }
    $app->config('app_settings', $settings);
    $app->config('debug', $settings['debug']);
} else {
    $installPath = rtrim(str_replace('index.php', '', $app->request()->getRootUri()), '/');
    header('Location: ' . $installPath . '/install.php');
    exit;
}

// add ContentTypes Middleware to parse json requests 
$app->add(new \Slim\Middleware\ContentTypes);

// set up idiorm ORM
ORM::configure(array(
    'connection_string' => 'mysql:host=' . $settings['dbhost'] . ';dbname=' . $settings['dbname'],
    'username' => $settings['dbuser'],
    'password' => $settings['dbpass']
));

// force the MySQL driver to use utf8
ORM::configure('driver_options', array(PDO::MYSQL_ATTR_INIT_COMMAND => 'SET NAMES utf8'));

/**
 * use a slim.before hook to check for an auth token in the request
 */
$app->hook('slim.before', function() use ($app) {
    $settings = $app->config('app_settings');
    $env = $app->environment();

    // get root uri and make sure to remove the index.php part to create the baseUrl variable
    $base = $app->request()->getRootUri();
    if(strpos($app->request()->getRootUri(), 'index.php')) {
        $base = rtrim(str_replace('index.php', '', $base), '/');
    }

    $app->view()->appendData(array('baseUrl' => $base . '/'));
    $app->view()->appendData(array('appName' => $settings['app_name']));

    if(isset($env['AUTH_ADMIN']) && $env['AUTH_ADMIN'] == "true") {
      if(isset($env['AUTH_TOKEN'])
        && $env['AUTH_TOKEN'] == $settings['token'] 
        && (strtotime(date('Y-m-d H:i')) <  strtotime($settings['token_date'] . ' + 1 hour'))) {
            $app->config('auth', true);
      } else {
        $app->halt(401);
      }
    }
});

/**
 * return jsonp or json depending on the callback param
 *
 * @param array $data
 */
function getResponse($data) {
    $app = \Slim\Slim::getInstance(); // get Slim framework instance
    if($app->request()->isAjax()) {
        $app->response()->header('Content-Type', 'application/json');
        $callback = $app->request()->get('callback');
        $json = json_encode($data);
        if($callback) {
            return $callback . '(' . $json . ')';
        } else {
            return $json;
        }
    } else {
        return $app->render('client.html', array('data'=>$data));
    }
}

/**
 * generate random codes. Used to create auth and update tokens
 */
function getCode() {
    $chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    $token = '';
    $charsLength = strlen($chars) - 1;
    // generate a 32 characters long random string
    for ($i = 0; $i < 32; $i++) {
        $token .= $chars[rand(0, $charsLength)];
    }
    return $token;
}

/**
 * validate job offer before saving to the database
 *
 * @param array $job
 */
function validateJob($job) {
    try {
        $jobValidator = v::arr()
            ->key('title', v::string()->notEmpty())
            ->key('company', v::string()->notEmpty())
            ->key('email', v::email()->notEmpty())
            ->key('city', v::string()->notEmpty())
            ->key('web', v::call('parse_url', 
                v::arr()->key('scheme', v::startsWith('http'))
                ->key('host', v::domain())
            )->notEmpty())
            ->key('description', v::string()->notEmpty());
        $jobValidator->assert($job);
        return true;
    } catch(\InvalidArgumentException $e) {
        return getResponse($e->findMessages(array(
            'title' => 'Please write a title', 
            'company' => 'Please write the company name',
            'email' => 'Please enter a valid email address',
            'city' => 'Please write the city name',
            'web' => 'Please enter a valid web url (including the <i>http</i> part)',
            'description' => 'Please write a description')));
    }
}
 
/**
 * set the 404 not found error to render the HTML client and display the error message
 */
$app->notFound(function() use ($app) {
    $app->render('client.html');
});
