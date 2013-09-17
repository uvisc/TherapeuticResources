<?php

/*******************************
 ********** USER AUTH **********
 *******************************/
 /**
  * serve admin HTML5 client
  */
 $app->get($app->config('admin.url'), function() use ($app) {
     $app->render('admin.html');
 });

/**
 * Authenticate user and send a token which should be used in auth requests
 */
$app->post(
    '/users/authentication',
    function() use ($app) {
        $username = $app->request()->post('username');
        $password = $app->request()->post('password');
        $settings = $app->config('app_settings');
        if($username== $settings['username'] && $password==$settings['password']) {
            $token = getCode();
            $settings['token'] = $token;
            $settings['token_date'] = date('Y-m-d H:i');
            $dumper = new Symfony\Component\Yaml\Dumper();
            file_put_contents(__DIR__ . '/../config/settings.yml', $dumper->dump($settings, 2));
            echo getResponse(array('token' => $token));
        } else {
            $app->status(401);
        }
    }
);

/**
 * request a job token to edit or delete a job offer
 */
$app->post(
    '/users/token',
    function() use ($app) {
        $jobId = $app->request()->post('id');
        $email = $app->request()->post('email');
        $ORMjob = ORM::for_table('jobs')
            ->select('id')
            ->where('email', $email)
            ->where('id', $jobId)
            ->find_one();
        if($ORMjob) {
            $settings = $app->config('app_settings');
            $token = getCode();
            $ORMjob->code = $token;
            $ORMjob->save();
            $msg = "Please use this link to edit your job offer: \r\n\r\n"
            . $app->request()->getUrl() . $app->urlFor('jobs') . '/edit/' . $ORMjob->id() . '/' . $ORMjob->code;
            $headers = 'FROM: ' . $settings['system_email'];
            mail($email, 'Job offer edit link', $msg, $headers);
        } else {
            $app->status(404);
            $app->notFound();
        }
    }
);

/******************************
 ********** JOBS API **********
 ******************************/

/**
* jobs listings function is used in the / and /jobs routes for the API and SEO purposes
*/
$jobsListings =  function() use ($app) {
    $page = (int) $app->request()->get('page');
    if($page < 0) $page = 0;
    $limit = 15;
    $offset = $limit * $page;
    $totalQuery = ORM::for_Table('jobs');
    if($app->config('auth')) { // user is authenticated
        $query = ORM::for_table('jobs')
            ->select('id')
            ->select('title')
            ->select('published')
            ->select('date')
            ->select('description')
            ->select('company')
            ->select('city')
            ->select('email') // only auth users get the email address
            ->select('web')
            ->order_by_desc('date')
            ->limit($limit)
            ->offset($offset);
    } else { // user is not authenticated
       $query = ORM::for_table('jobs')
           ->where('published', true) // only published job offers
           ->select('id')
           ->select('title')
           ->select('date')
           ->select('description')
           ->select('company')
           ->select('city')
           ->select('web')
           ->order_by_desc('date')
           ->limit($limit)
           ->offset($offset);
       $totalQuery->where('published', true);
    }

    if($app->request()->get('search')) {
        $query->where_like('title', '%' . $app->request()->get('search') . '%');
        $totalQuery->where_like('title', '%' . $app->request()->get('search') . '%');
    }

    $ORMjobs = $query->find_many();
    $total = $totalQuery->count();
    $settings = $app->config('app_settings');

    // shorten description and format date
    $jobs = array_map( function($j) use ($app, $settings) {
        $job = $j->as_array();
        $job['date'] = date($settings['date_format'], strtotime($job['date']));
        if(isset($job['published'])) $job['published'] = (bool) $job['published'];
        return $job;
    }, $ORMjobs );

    // send json data
    echo getResponse(array(
        'pagination'=>array(
            'total' => $total,
            'page' => $page,
            'limit' => $limit
        ),
        'jobs'=>$jobs
    ));
};

/**
 * the / route serves the jobs listings for SEO purposes
 * the /jobs route is used for the server API
 * both routes use the same callable
 */
$app->get('/', $jobsListings);
$app->get('/jobs', $jobsListings)->name('jobs');

/**
 * add a new job listing
 */
$app->post(
    '/jobs',
    function() use ($app) {
        $job = $app->request()->getBody();
        $job['date'] = date('Y-m-d H:m:i');
        $job['published'] = $app->config('auth');
        unset($job['id']);
        unset($job['code']);

        // generate an update token so the job offer can be updated by the user
        if(!$job['published']) {
            // get a token which doesn't already exist
            $existingTokens = ORM::for_table('jobs')->select('code')->where_not_null('code')->find_array();
            do {
                $job['code'] = getCode();
            } while(in_array(array('code'=>$job['code']), $existingTokens));
        }

        // data validation
        $valid = validateJob($job);
        if( $valid !== true) {
            $app->status(400);
            echo $valid;
            return;
        }

        $ORMjob = $ORMJob = ORM::for_table('jobs')->create();
        $ORMjob->set($job);
        if($ORMjob->save()) {
            if($job['published']) {
                $settings = $app->config('app_settings');
                $job['id'] = $ORMjob->id();
                $job['date'] = date($settings['date_format'], strtotime($job['date']));
                $job['description'] = nl2br($job['description']);
                echo getResponse($job);
            } else { // send an email confirmation link
                $settings = $app->config('app_settings');
                $msg = "Here's your email confirmation link: \r\n\r\n"
                . $app->request()->getUrl() . $app->urlFor('job', array('id' => $ORMjob->id())) . '/' . $job['code'];
                $headers = 'FROM: ' . $settings['system_email'];
                mail($job['email'], 'Email confirmation', $msg, $headers);
                $app->status(202);
            }
        } else {
            $app->status(500);
        }
    }
);

/**
 * get the job with id $id
 */
$app->get(
    '/jobs/:id',
    function($id) use ($app) {
        $env = $app->environment();
        if($app->config('auth') || $env['UPDATE_TOKEN']) { // user is authenticated
            $job = ORM::for_table('jobs')
                ->select('id')
                ->select('title')
                ->select('published')
                ->select('date')
                ->select('description')
                ->select('company')
                ->select('city')
                ->select('web')
                ->select('email')
                ->select('code')
                ->find_one($id);
        } else { // user is not authenticated
            $job = ORM::for_table('jobs')
                ->select('id')
                ->select('title')
                ->select('published')
                ->select('date')
                ->select('description')
                ->select('company')
                ->select('city')
                ->select('web')
                ->where('published', true)
                ->find_one($id);
        }

        if($job && (!$env['UPDATE_TOKEN'] || $env['UPDATE_TOKEN'] == $job->code)) {
            // format date and description
            $settings = $app->config('app_settings');
            $job = $job->as_array();
            $job['date'] = date($settings['date_format'], strtotime($job['date']));
            echo getResponse($job);
        } else {
            $app->status(404);
            $app->notFound();
        }
    }
)
->name('job')
->conditions(array('id'=>'[0-9]+'));

/**
 * update the post with id $id
 *
 * @param int id
 */
$app->put(
    '/jobs/:id',
    function($id) use ($app) {
        $job = $app->request()->getBody();
        $ORMjob = ORM::for_Table('jobs')->find_one($id);
        if($ORMjob) {
            $env = $app->environment();
            if($app->config('auth') || ($env['UPDATE_TOKEN'] == $ORMjob->code)) {
                $job = array_intersect_key($job, $ORMjob->as_array());
                $job = array_merge($ORMjob->as_array(), $job);
                unset($job['date']);
                $valid = validateJob($job);
                if( $valid !== true) {
                    $app->status(400);
                    echo $valid;
                    return;
                }
                $ORMjob->code = null;
                $ORMjob->set($job);
                $ORMjob->save();
                $job = $ORMjob->as_array();
                $settings = $app->config('app_settings');
                $job['date'] = date($settings['date_format'], strtotime($ORMjob->date)); // format date
                echo getResponse($job);
            } else {
                $app->status(401);
            }
        } else {
            $app->status(404);
        }
    }
)
->conditions(array('id'=>'[0-9]+'));

/**
 * delete the post with id $id
 *
 * @param int id
 */
$app->delete(
    '/jobs/:id',
    function($id) use ($app) {
        $job = ORM::for_table('jobs')->find_one($id);
        if($job) {
            $env = $app->environment();
            if($app->config('auth') || ($env['UPDATE_TOKEN'] == $job->code)) {
                $job->delete();
            } else {
                $app->status(401);
            }
        } else {
            $app->status(404);
        }
    }
)
->conditions(array('id'=>'[0-9]+'));
