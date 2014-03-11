<?php

class HomeController extends BaseController {

	

	public function home()
	{
		return View::make('home.welcome');

	}
	
	public function register()
	{
		return View::make('home.account_create');
	}

}