-- MySQL dump 10.13  Distrib 8.0.42, for Win64 (x86_64)
--
-- Host: 127.0.0.1    Database: mydb
-- ------------------------------------------------------
-- Server version	8.0.44

/*!40101 SET @OLD_CHARACTER_SET_CLIENT=@@CHARACTER_SET_CLIENT */;
/*!40101 SET @OLD_CHARACTER_SET_RESULTS=@@CHARACTER_SET_RESULTS */;
/*!40101 SET @OLD_COLLATION_CONNECTION=@@COLLATION_CONNECTION */;
/*!50503 SET NAMES utf8 */;
/*!40103 SET @OLD_TIME_ZONE=@@TIME_ZONE */;
/*!40103 SET TIME_ZONE='+00:00' */;
/*!40014 SET @OLD_UNIQUE_CHECKS=@@UNIQUE_CHECKS, UNIQUE_CHECKS=0 */;
/*!40014 SET @OLD_FOREIGN_KEY_CHECKS=@@FOREIGN_KEY_CHECKS, FOREIGN_KEY_CHECKS=0 */;
/*!40101 SET @OLD_SQL_MODE=@@SQL_MODE, SQL_MODE='NO_AUTO_VALUE_ON_ZERO' */;
/*!40111 SET @OLD_SQL_NOTES=@@SQL_NOTES, SQL_NOTES=0 */;

--
-- Table structure for table `categories`
--

DROP TABLE IF EXISTS `categories`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `categories` (
  `id` int NOT NULL AUTO_INCREMENT,
  `name` varchar(45) NOT NULL,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=5 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `categories`
--

LOCK TABLES `categories` WRITE;
/*!40000 ALTER TABLE `categories` DISABLE KEYS */;
INSERT INTO `categories` VALUES (1,'Món nước'),(2,'Món cơm'),(3,'Món ăn kèm'),(4,'Đồ uống & Thuốc lá');
/*!40000 ALTER TABLE `categories` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `order_details`
--

DROP TABLE IF EXISTS `order_details`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `order_details` (
  `id` int NOT NULL AUTO_INCREMENT,
  `order_id` int NOT NULL,
  `product_id` int NOT NULL,
  `quantity` int NOT NULL,
  `price` decimal(10,2) NOT NULL,
  `note` varchar(255) DEFAULT NULL,
  `status` enum('PENDING','COOKED','SERVED','PAID') NOT NULL DEFAULT 'PENDING',
  PRIMARY KEY (`id`),
  KEY `fk_order_details_orders_idx` (`order_id`),
  KEY `fk_order_details_products_idx` (`product_id`),
  CONSTRAINT `fk_order_details_orders` FOREIGN KEY (`order_id`) REFERENCES `orders` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `fk_order_details_products` FOREIGN KEY (`product_id`) REFERENCES `products` (`id`) ON DELETE RESTRICT ON UPDATE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=23 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `order_details`
--

LOCK TABLES `order_details` WRITE;
/*!40000 ALTER TABLE `order_details` DISABLE KEYS */;
INSERT INTO `order_details` VALUES (1,32,1,1,55000.00,NULL,'PAID'),(2,32,2,1,45000.00,NULL,'PAID'),(3,32,3,1,40000.00,NULL,'PAID'),(4,33,1,1,55000.00,NULL,'PAID'),(5,33,2,1,45000.00,NULL,'PAID'),(6,33,3,1,40000.00,NULL,'PAID'),(7,34,2,1,45000.00,NULL,'PAID'),(8,34,3,1,40000.00,NULL,'PAID'),(9,34,1,1,55000.00,NULL,'PAID'),(10,35,1,1,55000.00,NULL,'PAID'),(11,35,2,1,45000.00,NULL,'PAID'),(12,35,3,1,40000.00,NULL,'PAID'),(13,36,1,1,55000.00,NULL,'PAID'),(14,36,2,1,45000.00,NULL,'PAID'),(15,36,3,1,40000.00,NULL,'PAID'),(16,37,3,1,40000.00,NULL,'PAID'),(17,38,8,1,25000.00,NULL,'PENDING'),(18,38,7,1,15000.00,NULL,'PENDING'),(19,38,6,1,30000.00,NULL,'PENDING'),(20,39,3,1,40000.00,NULL,'PENDING'),(21,40,3,1,40000.00,NULL,'PENDING'),(22,40,7,2,15000.00,NULL,'PENDING');
/*!40000 ALTER TABLE `order_details` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `orders`
--

DROP TABLE IF EXISTS `orders`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `orders` (
  `id` int NOT NULL AUTO_INCREMENT,
  `table_id` int NOT NULL,
  `user_id` int DEFAULT NULL,
  `status` enum('PENDING','COOKED','SERVED','PAID','CANCELLED') NOT NULL DEFAULT 'PENDING',
  `total_amount` decimal(10,2) NOT NULL DEFAULT '0.00',
  `note` text,
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `fk_orders_tables_idx` (`table_id`),
  KEY `fk_orders_users_idx` (`user_id`),
  CONSTRAINT `fk_orders_tables` FOREIGN KEY (`table_id`) REFERENCES `tables` (`id`) ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT `fk_orders_users` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=41 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `orders`
--

LOCK TABLES `orders` WRITE;
/*!40000 ALTER TABLE `orders` DISABLE KEYS */;
INSERT INTO `orders` VALUES (32,1,8,'PAID',140000.00,NULL,'2025-11-17 09:17:10','2025-11-17 09:39:32'),(33,1,8,'PAID',140000.00,NULL,'2025-11-17 13:46:24','2025-11-17 13:47:16'),(34,1,8,'PAID',140000.00,NULL,'2025-11-17 13:47:37','2025-11-17 13:48:32'),(35,1,8,'PAID',140000.00,NULL,'2025-11-17 13:48:07','2025-11-17 13:48:32'),(36,1,8,'PAID',140000.00,NULL,'2025-11-17 13:50:38','2025-11-17 13:58:30'),(37,1,8,'PAID',40000.00,NULL,'2025-11-17 13:51:31','2025-11-17 13:58:30'),(38,1,8,'PENDING',70000.00,NULL,'2025-11-17 13:58:50','2025-11-17 13:58:50'),(39,1,8,'PENDING',40000.00,NULL,'2025-11-17 13:59:03','2025-11-17 13:59:03'),(40,1,8,'PENDING',70000.00,NULL,'2025-11-17 13:59:25','2025-11-17 13:59:25');
/*!40000 ALTER TABLE `orders` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `products`
--

DROP TABLE IF EXISTS `products`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `products` (
  `id` int NOT NULL AUTO_INCREMENT,
  `category_id` int NOT NULL,
  `name` varchar(100) NOT NULL,
  `price` decimal(10,2) NOT NULL,
  `quantity` int NOT NULL DEFAULT '0',
  `image_url` varchar(255) DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `fk_products_categories_idx` (`category_id`),
  CONSTRAINT `fk_products_categories` FOREIGN KEY (`category_id`) REFERENCES `categories` (`id`) ON DELETE RESTRICT ON UPDATE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=12 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `products`
--

LOCK TABLES `products` WRITE;
/*!40000 ALTER TABLE `products` DISABLE KEYS */;
INSERT INTO `products` VALUES (1,1,'Phở Bò Đặc Biệt',55000.00,25,'/images/pho_bo.jpg'),(2,1,'Bún Chả Hà Nội',45000.00,0,'/images/bun_cha.jpg'),(3,1,'Bún bò Huế',40000.00,0,'/images/bun_bo_hue.jpg'),(4,1,'Hủ tiếu Nam Vang',38000.00,0,'/images/hu_tieu.jpg'),(5,2,'Cơm gà xối mỡ',45000.00,0,'/images/com_ga.jpg'),(6,3,'Nem Rán Giòn',30000.00,39,'/images/nem_ran.jpg'),(7,4,'Nước Chanh',15000.00,92,'/images/nuoc_chanh.jpg'),(8,4,'Cà phê sữa đá',25000.00,76,'/images/ca_phe_sua.jpg'),(9,4,'Bia Tiger',22000.00,116,'/images/tiger_beer.jpg'),(10,4,'Bia Heineken',25000.00,93,'/images/heineken.jpg'),(11,4,'Thuốc Lá Marlboro',35000.00,183,'/images/marlboro.jpg');
/*!40000 ALTER TABLE `products` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `tables`
--

DROP TABLE IF EXISTS `tables`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `tables` (
  `id` int NOT NULL AUTO_INCREMENT,
  `name` varchar(45) NOT NULL,
  `status` enum('Trống','Có khách','Đã đặt','Đang dọn') NOT NULL DEFAULT 'Trống',
  PRIMARY KEY (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=5 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `tables`
--

LOCK TABLES `tables` WRITE;
/*!40000 ALTER TABLE `tables` DISABLE KEYS */;
INSERT INTO `tables` VALUES (1,'1','Có khách'),(2,'2','Trống'),(3,'3','Trống'),(4,'4','Trống');
/*!40000 ALTER TABLE `tables` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `users`
--

DROP TABLE IF EXISTS `users`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `users` (
  `id` int NOT NULL AUTO_INCREMENT,
  `username` varchar(50) NOT NULL,
  `password` varchar(255) NOT NULL,
  `role` enum('ADMIN','EMPLOYEE','MANAGER','CHEF') NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `username` (`username`)
) ENGINE=InnoDB AUTO_INCREMENT=14 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `users`
--

LOCK TABLES `users` WRITE;
/*!40000 ALTER TABLE `users` DISABLE KEYS */;
INSERT INTO `users` VALUES (5,'trungquyen','$2b$10$4VF82jo1.RTbpZzUMgMCAucU7PRPr.ravTrNENdeNcFTrQbiImk4i','MANAGER'),(8,'nhanvien','$2b$10$Pqf7U26inCcTA3Z3vjhasO9B81YZe8jUobsT3s3wf8ipbAqI/pWUK','EMPLOYEE'),(9,'daubep','$2b$10$zFQHr4QUR63wqnxvQnIbJeYaizRsl/FVMpvS4QqBdHFVrubKjF35S','CHEF'),(10,'admin','$2b$10$NcJHd.YY/vEjT4HL/1tmveGpmHYKnLGRuZ9GSZFMKIMPp6Q2yvnyq','ADMIN'),(11,'quanli','$2b$10$iMXlSH80NaTFlQt81lP/NebMOYnubJq3BLXx/z9rGVMA8wXcGXLNK','MANAGER'),(12,'qqq','$2b$10$wMovEp8WdMsnq1S6sEYweOzlo24ZGvkblH2zUaU3r5VP5537vv9v.','MANAGER'),(13,'doantatanh','$2b$10$ar3sMEEXSQeXvq8uQtNkLOtE4u1HC4VwJBGvvHAUw9sGbE4wru9sm','CHEF');
/*!40000 ALTER TABLE `users` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `vnpay_transactions`
--

DROP TABLE IF EXISTS `vnpay_transactions`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `vnpay_transactions` (
  `txn_ref` varchar(100) NOT NULL,
  `order_id` int NOT NULL,
  `amount` bigint NOT NULL,
  `vnp_create_date` varchar(14) NOT NULL,
  `status` varchar(20) NOT NULL DEFAULT 'PENDING',
  `vnp_transaction_no` varchar(15) DEFAULT NULL,
  `vnp_response_code` varchar(10) DEFAULT NULL,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`txn_ref`),
  KEY `idx_order_id` (`order_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `vnpay_transactions`
--

LOCK TABLES `vnpay_transactions` WRITE;
/*!40000 ALTER TABLE `vnpay_transactions` DISABLE KEYS */;
INSERT INTO `vnpay_transactions` VALUES ('17142630',1,11115000000,'20251117142630','PENDING',NULL,NULL,'2025-11-17 07:26:47'),('17143656',1,11115000000,'20251117143656','PENDING',NULL,NULL,'2025-11-17 07:37:16'),('17144818',1,11115000000,'20251117144818','FAILED',NULL,'24','2025-11-17 07:49:12'),('17145310',1,1000000,'20251117145310','PENDING',NULL,NULL,'2025-11-17 07:53:29'),('17145338',1,11115000000,'20251117145338','PENDING',NULL,NULL,'2025-11-17 07:53:57'),('17153008',1,11115000000,'20251117153008','PAID',NULL,'00','2025-11-17 08:31:17'),('17153347',1,11115000000,'20251117153347','PAID',NULL,'00','2025-11-17 08:34:54'),('17153704',1,11115000000,'20251117153704','PAID',NULL,'00','2025-11-17 08:37:59'),('17214742',1,11115000000,'20251117214742','PAID',NULL,'00','2025-11-17 14:48:58'),('17214858',1,11115000000,'20251117214858','PENDING',NULL,NULL,'2025-11-17 14:49:17'),('17214910',1,11110000,'20251117214910','PENDING',NULL,NULL,'2025-11-17 14:49:29'),('23104109',1,18000000,'20251123104109','PENDING',NULL,NULL,'2025-11-23 03:41:25'),('23121902',1,18000000,'20251123121902','PENDING',NULL,NULL,'2025-11-23 05:19:17'),('23123339',1,18000000,'20251123123339','PENDING',NULL,NULL,'2025-11-23 05:33:54'),('23456ags345',2,11110000,'20251123145157','PENDING',NULL,NULL,'2025-11-23 07:52:12'),('ORD1763876178402',1,18000000,'20251123123618','PENDING',NULL,NULL,'2025-11-23 05:36:33'),('ORD1763878665161',1,18000000,'20251123131745','PENDING',NULL,NULL,'2025-11-23 06:18:00'),('ORD1763883758596',40,18000000,'20251123144238','PENDING',NULL,NULL,'2025-11-23 07:42:38');
/*!40000 ALTER TABLE `vnpay_transactions` ENABLE KEYS */;
UNLOCK TABLES;
/*!40103 SET TIME_ZONE=@OLD_TIME_ZONE */;

/*!40101 SET SQL_MODE=@OLD_SQL_MODE */;
/*!40014 SET FOREIGN_KEY_CHECKS=@OLD_FOREIGN_KEY_CHECKS */;
/*!40014 SET UNIQUE_CHECKS=@OLD_UNIQUE_CHECKS */;
/*!40101 SET CHARACTER_SET_CLIENT=@OLD_CHARACTER_SET_CLIENT */;
/*!40101 SET CHARACTER_SET_RESULTS=@OLD_CHARACTER_SET_RESULTS */;
/*!40101 SET COLLATION_CONNECTION=@OLD_COLLATION_CONNECTION */;
/*!40111 SET SQL_NOTES=@OLD_SQL_NOTES */;

-- Dump completed on 2025-11-23 22:11:21
