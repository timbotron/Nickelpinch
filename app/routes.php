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
Route::get('/login','HomeController@home');
Route::get('/register', 'HomeController@register');
Route::post('/register', 'HomeController@process_register');

Route::group(array('before'=>'auth'), function()
{

	Route::get('/home', 'AppController@main');

	Route::resource('/budget', 'BudgetController');
	//Route::get('/budget', 'AppController@budget');
	//Route::post('/budget', 'AppController@save_category');
	//Route::get('/budget/edit/{ucid}', 'AppController@edit_category');
	//Route::post('/budget/edit/{ucid}', 'AppController@save_category');
});





//Route::get('/reports', 'ReportController@history');
