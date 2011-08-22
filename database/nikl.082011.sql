SET @OLD_UNIQUE_CHECKS=@@UNIQUE_CHECKS, UNIQUE_CHECKS=0;
SET @OLD_FOREIGN_KEY_CHECKS=@@FOREIGN_KEY_CHECKS, FOREIGN_KEY_CHECKS=0;
SET @OLD_SQL_MODE=@@SQL_MODE, SQL_MODE='TRADITIONAL';

CREATE SCHEMA IF NOT EXISTS `np_database` DEFAULT CHARACTER SET utf8 ;
USE `np_database` ;

-- -----------------------------------------------------
-- Table `np_database`.`users`
-- -----------------------------------------------------
CREATE  TABLE IF NOT EXISTS `np_database`.`users` (
  `uid` INT UNSIGNED NOT NULL AUTO_INCREMENT ,
  `username` VARCHAR(90) NOT NULL ,
  `upass` VARCHAR(90) NOT NULL ,
  `email` VARCHAR(199) NOT NULL ,
  `rank` TINYINT UNSIGNED NOT NULL ,
  `currency` TINYINT UNSIGNED NOT NULL ,
  `last_login` DATETIME NOT NULL ,
  `active` TINYINT UNSIGNED NOT NULL ,
  PRIMARY KEY (`uid`) ,
  UNIQUE INDEX `username_UNIQUE` (`username` ASC) )
ENGINE = InnoDB;


-- -----------------------------------------------------
-- Table `np_database`.`entries`
-- -----------------------------------------------------
CREATE  TABLE IF NOT EXISTS `np_database`.`entries` (
  `ent_id` INT UNSIGNED NOT NULL AUTO_INCREMENT ,
  `uid` INT UNSIGNED NOT NULL ,
  `ent_time` DATE NOT NULL ,
  `desc` VARCHAR(199) NULL ,
  PRIMARY KEY (`ent_id`) ,
  INDEX `i_date` (`ent_time` ASC) ,
  INDEX `i_ufid` (`uid` ASC) ,
  CONSTRAINT `fk_entries_users1`
    FOREIGN KEY (`uid` )
    REFERENCES `np_database`.`users` (`uid` )
    ON DELETE NO ACTION
    ON UPDATE NO ACTION)
ENGINE = InnoDB;


-- -----------------------------------------------------
-- Table `np_database`.`user_folders`
-- -----------------------------------------------------
CREATE  TABLE IF NOT EXISTS `np_database`.`user_folders` (
  `ufid` INT UNSIGNED NOT NULL AUTO_INCREMENT ,
  `uid` INT UNSIGNED NOT NULL ,
  `name` VARCHAR(90) NOT NULL ,
  `class` TINYINT UNSIGNED NOT NULL COMMENT '0=folder,1=cc,2=usersres' ,
  `limit` DECIMAL(22,2) NOT NULL ,
  `reserve` DECIMAL(22,2) NOT NULL ,
  `current` DECIMAL(22,2) NOT NULL ,
  `active` TINYINT NOT NULL ,
  PRIMARY KEY (`ufid`) ,
  INDEX `fk_user_folders_users1` (`uid` ASC) ,
  CONSTRAINT `fk_user_folders_users1`
    FOREIGN KEY (`uid` )
    REFERENCES `np_database`.`users` (`uid` )
    ON DELETE NO ACTION
    ON UPDATE NO ACTION)
ENGINE = InnoDB;


-- -----------------------------------------------------
-- Table `np_database`.`entry_data`
-- -----------------------------------------------------
CREATE  TABLE IF NOT EXISTS `np_database`.`entry_data` (
  `edid` INT UNSIGNED NOT NULL AUTO_INCREMENT ,
  `ent_id` INT UNSIGNED NOT NULL ,
  `ufid` INT UNSIGNED NOT NULL ,
  `amount` DECIMAL(22,2) NOT NULL ,
  `add_or_remove` TINYINT UNSIGNED NOT NULL ,
  `paid_from` TINYINT UNSIGNED NOT NULL COMMENT '0=pot,2=ufids reserve' ,
  PRIMARY KEY (`edid`) ,
  INDEX `fk_entry_data_entries1` (`ent_id` ASC) ,
  CONSTRAINT `fk_entry_data_entries1`
    FOREIGN KEY (`ent_id` )
    REFERENCES `np_database`.`entries` (`ent_id` )
    ON DELETE NO ACTION
    ON UPDATE NO ACTION,
  CONSTRAINT `fk_entry_data_user_folders2`
    FOREIGN KEY (`ufid` )
    REFERENCES `np_database`.`user_folders` (`ufid` )
    ON DELETE NO ACTION
    ON UPDATE NO ACTION)
ENGINE = InnoDB;


-- -----------------------------------------------------
-- Table `np_database`.`month_reports`
-- -----------------------------------------------------
CREATE  TABLE IF NOT EXISTS `np_database`.`month_reports` (
  `mid` INT UNSIGNED NOT NULL AUTO_INCREMENT ,
  `uid` INT UNSIGNED NOT NULL ,
  `ufid` INT UNSIGNED NOT NULL ,
  `m_date` DATE NOT NULL ,
  `total` DECIMAL(22,2) NOT NULL ,
  `limit` DECIMAL(22,2) NOT NULL COMMENT 'copy over limit from user_folder at time of generation' ,
  PRIMARY KEY (`mid`) ,
  INDEX `fk_month_reports_user_folders1` (`ufid` ASC) ,
  CONSTRAINT `fk_month_reports_users2`
    FOREIGN KEY (`uid` )
    REFERENCES `np_database`.`users` (`uid` )
    ON DELETE NO ACTION
    ON UPDATE NO ACTION,
  CONSTRAINT `fk_month_reports_user_folders1`
    FOREIGN KEY (`ufid` )
    REFERENCES `np_database`.`user_folders` (`ufid` )
    ON DELETE NO ACTION
    ON UPDATE NO ACTION)
ENGINE = InnoDB;


-- -----------------------------------------------------
-- Table `np_database`.`pass_reset`
-- -----------------------------------------------------
CREATE  TABLE IF NOT EXISTS `np_database`.`pass_reset` (
  `prid` INT UNSIGNED NOT NULL AUTO_INCREMENT ,
  `uid` INT UNSIGNED NOT NULL ,
  `reset_date` DATETIME NOT NULL ,
  PRIMARY KEY (`prid`) ,
  UNIQUE INDEX `uid_UNIQUE` (`uid` ASC) ,
  CONSTRAINT `fk_pass_reset_users2`
    FOREIGN KEY (`uid` )
    REFERENCES `np_database`.`users` (`uid` )
    ON DELETE NO ACTION
    ON UPDATE NO ACTION)
ENGINE = InnoDB;



SET SQL_MODE=@OLD_SQL_MODE;
SET FOREIGN_KEY_CHECKS=@OLD_FOREIGN_KEY_CHECKS;
SET UNIQUE_CHECKS=@OLD_UNIQUE_CHECKS;
