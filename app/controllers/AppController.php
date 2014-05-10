<?php

class AppController extends BaseController {

	
	public function __construct()
	{
		parent::__construct();


		$this->user = User::with('user_categories')->where('users.uid','=',Auth::user()->uid)->get()[0];
		View::share('user_data',$this->user);

		$this->nikl_config = Config::get('nickelpinch');
		View::share('nikl_config',$this->nikl_config);



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
		//dd($this->user->user_categories);
		

		View::share('chosen_page','budget');
		View::share('dom_dd',$this->dom_dd);
		return View::make('app.budget');
	}

	public function save_category()
	{
		$rules = [
					'category_name' => 'required|between:4,255',
					'top_limit'		=> 'required|numeric',
					'due_date'		=> 'integer',
					'class'			=> 'required'
		];

		$validator = Validator::make(Input::all(), $rules);
		if($validator->passes())
		{

			// Gotta store user_category
			$uc = new User_category;
			$uc->uid = $this->user->uid;
			$uc->category_name = Input::get('category_name');
			$uc->top_limit = Input::get('top_limit');
			$uc->class = $this->nikl_config['uc_classes'][Input::get('class')];

			if(Input::get('class')=='credit_card') $uc->due_date = Input::get('due_date');

			$uc->save();

			// Hash::make($password);
			return Redirect::to('/budget');
		}
		else
		{
			return Redirect::to('/budget')->withErrors($validator)->withInput();
		}
	}

}