<?php

class AppController extends BaseAppController {

	
	public function __construct()
	{
		parent::__construct();

	}

	public function main()
	{
		if($this->_is_new()) return Redirect::to('welcome');

		if(Cookie::has('default_view')) {
			$layout = Cookie::get('default_view');
		} else {
			$layout = 'simple';
		}

		View::share('chosen_page','home');
		return View::make('app.main',['layout'=>$layout]);
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
		$form2_data = array('url' => 'api/save_default_view',
							'class'=>'form well ajax-me',
							'data-id'=>'default_view',
							'data-target'=>'/home',
							'autocomplete'=>'off',
							'method'=>'POST');
		$overview_detail_options = ['simple'=>'Simple View',
									'detailed'=>'Detailed View'];
		return View::make('app.settings',['form1_data' => $form1_data,
										'form2_data' => $form2_data,
										'paid_with' => $this->make_paid_via(),
										'view_opts' => $overview_detail_options
										]);
	}

	public function save_default_pmt()
	{
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

		public function save_default_view()
	{
		$rules = [
					'chosen_default_view' 		=> 'required'
		];

		$validator = Validator::make(Input::all(), $rules);

		if($validator->passes())
		{
			// Gotta update cookie to use chosen default view TODO timh 05/17
			Cookie::forever('default_view',Input::get('chosen_default_view'));

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