--
-- Table structure for table `jobs`
--

CREATE TABLE IF NOT EXISTS `jobs` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `title` varchar(300) NOT NULL,
  `city` varchar(200) NOT NULL,
  `company` varchar(200) NOT NULL,
  `web` varchar(500) NOT NULL,
  `email` varchar(200) NOT NULL,
  `description` text NOT NULL,
  `published` tinyint(4) NOT NULL,
  `date` datetime NOT NULL,
  `code` varchar(32) DEFAULT NULL,
  PRIMARY KEY (`id`)
) ENGINE=MyISAM  DEFAULT CHARSET=utf8 COLLATE=utf8_unicode_ci;