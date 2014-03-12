<?php

class HomeController extends BaseController {

	

	public function home()
	{
		return View::make('home.welcome');

	}
	
	public function register()
	{
		View::share('default_currency',Config::get('nickelpinch.default_currency'));
		return View::make('home.account_create');
	}

	public function process_register()
	{
		$rules = [
					'username' 		=> 'required|alpha_dash|unique:users,username|between:4,30',
					'password'		=> 'required|alpha_dash|between:4,60',
					'email'			=> 'required|email|unique:users,email|max:90',
					'currency'		=> 'required',
		];

		$validator = Validator::make(Input::all(), $rules);

		if($validator->passes())
		{
			// Gotta store user
			$user = new User;
			$user->username = Input::get('username');
			$user->email = Input::get('email');
			$user->currency = Input::get('currency');
			$user->rank = Config::get('nickelpinch.default_rank');
			$user->password = Hash::make(Input::get('password'));
			$user->save();

			// Hash::make($password);
			return Redirect::to('/');
		}
		else
		{
			return Redirect::to('/register')->withErrors($validator)->withInput();
		}


	}

}