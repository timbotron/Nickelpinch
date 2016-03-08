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
Route::post('login','HomeController@login');
Route::get('login','HomeController@home');
Route::get('register', 'HomeController@register');
Route::post('register', 'HomeController@process_register');

Route::group(['before'=>'auth'], function()
{	
	Route::get('logout','HomeController@logout');

	Route::get('home', 'AppController@main');
	Route::get('welcome', 'AppController@welcome');
	Route::get('settings','AppController@settings');
	Route::post('api/save_default_pmt','AppController@save_default_pmt');

	Route::resource('budget', 'BudgetController');
	Route::get('add_bank', 'BudgetController@add_bank');

	Route::get('add/{target}', 'EntryController@create');
	Route::get('save/{target}', 'EntryController@save');
	Route::get('paycc/{target}', 'EntryController@paycc');
	Route::get('inout', 'EntryController@inout');
	Route::get('move', 'EntryController@move');
	Route::post('api/new_entry/{type}', 'EntryController@store');
	Route::get('api/entry_detail/{id}', 'EntryController@show');
	Route::delete('api/entry_delete/{id}', 'EntryController@destroy');
	Route::post('api/cat_reset','EntryController@cat_reset');

	Route::get('/history', 'HistoryController@index');
	Route::get('/history/{target}', 'HistoryController@index');
	Route::get('/history/{target}/{range}', 'HistoryController@index');
});





