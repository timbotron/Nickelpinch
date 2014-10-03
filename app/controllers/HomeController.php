<?php

class HomeController extends BaseController {

	public function __construct()
	{
		parent::__construct();
		View::share('chosen_page',false);
	}

	public function logout()
	{
		Auth::logout();
		return Redirect::to('/');

	}

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
			$validator->getMessageBag()->add('good', 'Account Created; login to proceed!');
			return Redirect::to('/')->withErrors($validator);
		}
		else
		{
			return Redirect::to('/register')->withErrors($validator)->withInput();
		}


	}

	public function login()
	{
		$rules = [
					'username' 		=> 'required',
					'password'		=> 'required',
		];

		$validator = Validator::make(Input::all(), $rules);

		if($validator->passes())
		{
			$remember = Input::get('remember_me')!='' ? true : false;
			//dd(Auth::attempt(array('username' => Input::get('username'), 'password' => Input::get('password')),$remember));
			if(Auth::attempt(array('username' => Input::get('username'), 'password' => Input::get('password')),$remember))
			{
			    return Redirect::intended('home');
			}

			$validator->getMessageBag()->add('bad', 'Username or password invalid');
			return Redirect::to('/')->withErrors($validator);
			
		}
		else
		{
			return Redirect::to('/')->withErrors($validator);
		}
	}

}