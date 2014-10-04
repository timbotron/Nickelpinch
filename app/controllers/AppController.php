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
		View::share('chosen_page','settings');
		$form1_data = array('url' => 'api/save_default_pmt',
							'class'=>'form well ajax-me',
							'data-id'=>'default_pmt',
							'data-target'=>'/home',
							'autocomplete'=>'off',
							'method'=>'POST');
		return View::make('app.settings',['form1_data'=>$form1_data,	
										'paid_with'=>$this->make_paid_via()
										]);
	}

	public function save_default_pmt()
	{
		//dd($this->user);
		$rules = [
					'chosen_default_pmt' 		=> 'required'
		];

		$validator = Validator::make(Input::all(), $rules);

		if($validator->passes())
		{
			// Gotta store user
			$this->user->default_pmt_method = Input::get('chosen_default_pmt');
			$this->user->save();

			return Response::json(array('success' => true), 200);
		}
		else
		{
			return Response::json(array('status' => false, 'errors' => array('total'=>'There was a problem saving this change.')), 400);
		}
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