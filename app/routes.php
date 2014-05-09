<?php

/*
|--------------------------------------------------------------------------
| Application Routes
|--------------------------------------------------------------------------
|
| Here is where you can register all of the routes for an application.
| It's a breeze. Simply tell Laravel the URIs it should respond to
| and give it the Closure to execute when that URI is requested.
|
*/

Route::get('/', 'HomeController@home');

Route::post('/login','HomeController@login');
Route::get('/register', 'HomeController@register');
Route::post('/register', 'HomeController@process_register');

Route::get('/home', 'AppController@main');
Route::get('/budget', 'AppController@budget');
Route::post('/budget', 'AppController@budget');





//Route::get('/reports', 'ReportController@history');
