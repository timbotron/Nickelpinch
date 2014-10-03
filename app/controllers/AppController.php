<?php

class AppController extends BaseAppController {

	
	public function __construct()
	{
		parent::__construct();

	}

	public function main()
	{
		if($this->_is_new()) return Redirect::to('welcome');

		View::share('chosen_page','home');
		return View::make('app.main');
	}

	public function settings()
	{
		
	}

	public function welcome()
	{
		View::share('chosen_page','home');

		return View::make('app.welcome');
	}

	private function _is_new()
	{
		if(!$this->bank_info) return true;

		$count = 0;
		foreach($this->user->user_categories as $cat)
		{
			if($cat->class != 8 && $cat->class != 255) $count++;
		}




		if(!$count) return true;

		return false;
	}



}