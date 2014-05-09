<?php

class AppController extends BaseController {

	
	public function __construct()
	{
		parent::__construct();


		//dropdown for 31 days
		$this->dom_dd = array();
		for($i=1;$i<32;$i++)
		{
			$this->dom_dd[$i] = $i;
		}
	}

	public function main()
	{
		dd(Auth::user());
	}

	public function budget()
	{
		//dd(Auth::check());
		if(!Auth::check()) return Redirect::to('/');

		View::share('chosen_page','budget');
		View::share('dom_dd',$this->dom_dd);
		return View::make('app.budget');
	}

}