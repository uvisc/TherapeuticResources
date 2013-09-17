<?php
require __DIR__ . '/vendor/autoload.php';

// get base url
$s = empty($_SERVER["HTTPS"]) ? '' : ($_SERVER["HTTPS"] == "on") ? "s" : "";
$sp = strtolower($_SERVER["SERVER_PROTOCOL"]);
$protocol = substr($sp, 0, strpos($sp, "/")) . $s;
$port = ($_SERVER["SERVER_PORT"] == "80") ? "" : (":".$_SERVER["SERVER_PORT"]);
$path_info = ltrim('/', pathinfo($_SERVER['REQUEST_URI'], PATHINFO_DIRNAME));
$base = $protocol . "://" . $_SERVER['SERVER_NAME'] . $port . $path_info;

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

// get all published job offers
$ORMjobs = ORM::for_table('jobs')->where('published', true)->find_many();

// echo xml header
echo '<?xml version="1.0" encoding="utf-8"?>';
?>
<urlset xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xsi:schemaLocation="http://www.sitemaps.org/schemas/sitemap/0.9 http://www.sitemaps.org/schemas/sitemap/0.9/sitemap.xsd" xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
    <url>
        <loc><?php echo $base  ?></loc>
        <changefreq>daily</changefreq>
        <priority>1.0</priority>
    </url>
    <?php foreach ($ORMjobs as $job) { ?>
    <url>
        <loc><?php  echo $base . '/jobs/' . $job->id ?></loc>
        <lastmod><?php echo date(DateTime::ATOM, strtotime($job->date)) ?></lastmod>
        <priority>0.8</priority>
    </url>
    <?php } ?>
</urlset>