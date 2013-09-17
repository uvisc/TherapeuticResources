<?php
/**
 * 
 */

require __DIR__ . '/vendor/autoload.php';

// load settings from the yml file
try {
  $settings =  \Symfony\Component\Yaml\Yaml::parse(file_get_contents(__DIR__ . '/config/settings.yml'));
} catch(\Symfony\Component\Yaml\Exception\ParseException $e) {
}

// set up idiorm ORM
ORM::configure(array(
    'connection_string' => 'mysql:host=' . $settings['dbhost'] . ';dbname=' . $settings['dbname'],
    'username' => $settings['dbuser'],
    'password' => $settings['dbpass']
));

/******************************
 ********** CRON URL **********
 ******************************/

/**
 * delete old job offers.
 * This route is intended to be run periodically using a cronjob
 */

ORM::for_table('jobs')
  ->where_lt('date', date('Y-m-d', strtotime('-20 days')))
  ->delete_many();

?>
200