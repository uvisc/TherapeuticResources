<?php

require __DIR__ . '/vendor/autoload.php';

use Respect\Validation\Validator as v;

// cariable for installed status
$installed = false;

// variable for install form errors
$hasErrors = false;

/**
 * form validation errors array
 */
$errors = array(
  'dbhost' => '', 
  'dbname' => '',
  'dbuser' => '',
  'dbpass' => '',
  'app_name' => '',
  'username' => '',
  'password' => '',
  'system_email' => '',
  'generic_error' => ''
);

/**
 * form default settings array
 */
$settings = array(
  'dbhost' => 'localhost', 
  'dbname' => '',
  'dbuser' => '',
  'dbpass' => '',
  'app_name' => '',
  'username' => 'admin',
  'password' => '',
  'system_email' => ''
);


// if the settings file already exists throw a 404 status error
if(file_exists(__DIR__ . '/config/settings.yml')) {
  $installed = true;
} else if($_POST) {

  $settings = $_POST;
  try {
    $installValidator = v::arr()
    ->key('dbhost', v::string()->notEmpty())
    ->key('dbname', v::string()->notEmpty())
    ->key('dbuser', v::string()->notEmpty())
    /*->key('dbpass', v::string()->notEmpty())*/
    ->key('app_name', v::string()->notEmpty())
    ->key('username', v::string()->notEmpty())
    ->key('password', v::string()->notEmpty())
    ->key('system_email', v::email()->notEmpty());

    $installValidator->assert($settings);
  } catch(\InvalidArgumentException $e) {

    $errors = $e->findMessages(array(
      'dbhost' => '<p class="text-error">Please write a database host</p>', 
      'dbname' => '<p class="text-error">Please write the database name</p>',
      'dbuser' => '<p class="text-error">Please write a database username</p>',
/*      'dbpass' => '<p class="text-error">Please write a database password</p>',*/
      'app_name' => '<p class="text-error">Please write an application name</p>',
      'username' => '<p class="text-error">Please write a username</p>',
      'password' => '<p class="text-error">Please write a password</p>',
      'system_email' => '<p class="text-error">Please write a valid email address</p>',
      'generic_error' => ''
    ));
        $hasErrors = true;
  }

  if($hasErrors === false) {
    try {
      $conn = new PDO(
        "mysql:dbname=" . $settings['dbname'] . ";host=" . $settings['dbhost'],
        $settings['dbuser'], $settings['dbpass']);
        $conn->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);

        $sql = file_get_contents(__DIR__ . '/src/schema/install.sql');
        $conn->query($sql);
    } catch(PDOException $e) {
      $hasErrors = true;
      $errors['generic_error'] =
        '<p class="text-error">Could not connect to the database with the provided settings</p>';
    }

    if($hasErrors === false) {
      if(is_writable(__DIR__ . '/config/')) {

       $settings['debug'] = false;
       $settings['admin_url'] = '/admin';
       $settings['date_format'] = 'm/d/Y';

       $dumper = new Symfony\Component\Yaml\Dumper();
       file_put_contents(__DIR__ . '/config/settings.yml', $dumper->dump($settings, 2));
       $installed = true;
     } else {
       $errors['generic_error'] = '<p class="text-error">The <i>config/</i> directory must be writable</p>';
     }
    }
  }
}

?>
<!DOCTYPE HTML>
<html>
  <head>
    <meta charset="utf-8">
    <title>Jobs web installer</title>
    <link rel="stylesheet" href="components/bootstrap.css/css/bootstrap.min.css" type="text/css">
    <link rel="stylesheet" href="components/bootstrap.css/css/bootstrap-responsive.min.css" type="text/css">
    <style type="text/css" media="screen">
      #mod-rewrite {
        position: absolute;
        z-index: 2;
        top: 0;
        bottom: 0;
        right: 0;
        left: 0;
        background-color: #2c3e50;
      }
      #mod-rewrite p {
        background-color: #ecf0f1;
        padding: 1em;
        font-size: 1.5em;
        line-height: 1.5em;
        margin-top: 3em;
      }
    </style>
    <link rel="stylesheet" href="install/install.css" type="text/css">
  </head>
  <body>
    <div id="mod-rewrite">
      <div class="container">
      <p class="text-error">
        Your server doesn't seem to support mod_rewrite or it is not properly configured.<br>
        Please see the documentation for more information about this.
      </p>
      </div>
    </div>
    <header>
        <div class="container">
            <span id="logo">Jobs web installer</span>
        </div>
    </header>

    <div class="container">

    <?php if(!$installed) { ?>
    <form action="install.php" method="post" accept-charset="utf-8">
      <div id="form-panel" class="row-fluid">
    <div class="span6">
    <h4>1. Database settings</h4>
    <?php echo $errors['generic_error'] ?>
    <label for="dbhost">Database host</label>
    <input type="text" name="dbhost" value="<?php echo $settings['dbhost'] ?>" id="dbhost">
    <?php echo $errors['dbhost'] ?>

    <label for="dbname">Database name</label>
    <input type="text" name="dbname" value="<?php echo $settings['dbname'] ?>" id="dbname">
    <?php echo $errors['dbname'] ?>

    <label for="dbuser">Database username</label>
    <input type="text" name="dbuser" value="<?php echo $settings['dbuser'] ?>" id="dbuser">
    <?php echo $errors['dbuser'] ?>


    <label for="dbpass">Database password</label>
    <input type="password" name="dbpass" value="<?php echo $settings['dbpass'] ?>" id="dbpass">
    <?php echo $errors['dbpass'] ?>

    </div>
    <div class="span6">
      <h4>2. Application settings</h4>
      <label for="app_name">Application name</label>
      <input type="text" name="app_name" value="<?php echo $settings['app_name'] ?>" id="app_name">
      <?php echo $errors['app_name'] ?>

      <label for="username">Admin username</label>
      <input type="text" name="username" value="<?php echo $settings['username'] ?>" id="username">
      <?php echo $errors['username'] ?>

      <label for="password">Admin password</label>
      <input type="password" name="password" value="<?php echo $settings['password'] ?>" id="password">
      <?php echo $errors['password'] ?>

      <label for="system_email">System email</label>
      <input type="text" name="system_email" value="<?php echo $settings['system_email'] ?>" id="system_email">
      <?php echo $errors['system_email'] ?>

    </div>
  </div>
    <p><input type="submit" class="btn btn-success" value="Install Jobs"></p>
  </form>
  <?php } else { ?>
    <div class="installed">
      The application has been installed.
    </div>
  <?php } ?>
</div>

  </body>
</html>