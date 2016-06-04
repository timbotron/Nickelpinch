## Nickelpinch

Nickelpinch is a web-based, personal finance application. Features include a simple intuitive interface, budgeting, reports, etc.

It is open-source, and free to use.

## Official Documentation

Documentation for Nickelpinch can be found on the [Nickelpinch.org website](http://nickelpinch.org).

### License

Nickelpinch is open-sourced software licensed under the [MIT license](http://opensource.org/licenses/MIT)

## Installation

First of all copy environment configuration:

```cp .env.example.php .env.php```

In .env.php set your database name, host, user and password.

Now you can use composer to install Laravel:

```composer install```

After composer done run migration:

```php artisan migrate```

If you don't want to setup user just run db:seed:

```php artisan db:seed```

## Run

```php artisan serve --port 8000```

If you run db:seed you can now log in as `user1` with password `pass`. 