## Requirements

* LAMP Stack
* Shell access
* [Composer](https://getcomposer.org/)
* A MySQL database

## Installation 

You'll want to get a database with a user set up. Nickelpinch will create all the tables it needs.

Copy over the environment settings and populate it with your credentials you created.

ex: ```cp .env.example.php .env.php```

Then, in your ```.env.php```, add the credentials you just created

```
return [
		'DB_NAME' => 'xxxxxxxxx', // Database name
		'DB_USER' => 'xxxxxxxxx', // Database username
		'DB_PASS' => 'xxxxxxxxx', // Database users password
		'DB_HOST' => 'xxxxxxxxx'  // Database host address (localhost, an IP Address, etc.) 
];
```

Once that's saved, run:

 ```composer install``` 

 in the root directory of your Nickelpinch instance. This will download Laravel and other dependencies. It may take a while. Also, it can be pretty greedy with RAM.

Once composer is done running, run the migration to set up all the needed database tables, etc.

```php artisan migrate```

After that, you *must* seed the database. (This creates some necessary data)

```php artisan db:seed```

After that, your instance should be good to go!