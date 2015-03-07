<?php

class BudgetController extends \BaseAppController {



	/**
	 * Display a listing of the resource.
	 *
	 * @return Response
	 */
	public function index()
	{
		View::share('chosen_page','budget');
		View::share('dom_dd',$this->dom_dd);
		$form_data = array('url' => 'budget','class'=>'form well','autocomplete'=>'off','method'=>'POST');
		return View::make('budget.index',['form_data'=>$form_data,'the_class'=>'standard']);
	}


	/**
	 * Store a newly created resource in storage.
	 *
	 * @return Response
	 */
	public function store()
	{
		$rules = [
					'category_name' => 'required|between:3,255',
					'top_limit'		=> 'required|numeric',
					'due_date'		=> 'integer',
					'class'			=> 'required'
		];
		if(Input::get('class')=='bank_account') // means we're creating a bank account
		{
			$rules = [];
			$rules = [
					'category_name' => 'required|between:3,255',
					'balance'		=> 'required|numeric',
					'class'			=> 'required'
			];
		}

		$validator = Validator::make(Input::all(), $rules);
		if($validator->passes())
		{

			// Gotta store user_category
			$uc = new User_category;
			$uc->uid = $this->user->uid;
			$uc->category_name = Input::get('category_name');
			$uc->class = $this->nikl_config['uc_classes'][Input::get('class')];
			$uc->rank = Input::get('rank');
			
			if(Input::get('class')=='bank_account') $uc->balance = Input::get('balance');
			else $uc->top_limit = Input::get('top_limit');

			if(Input::get('class')=='credit_card') $uc->due_date = Input::get('due_date');

			$uc->save();

			// Hash::make($password);
			if(Input::get('class')=='bank_account') return Redirect::to('/home');
			else return Redirect::to('/budget');
		}
		else
		{
			if(Input::get('class')=='bank_account') return Redirect::to('/add_bank')->withErrors($validator)->withInput();
			else return Redirect::to('/budget')->withErrors($validator)->withInput();
		}
	}


	/**
	 * Show the form for editing the specified resource.
	 *
	 * @param  int  $id
	 * @return Response
	 */
	public function edit($id)
	{
		$uc = User_category::find($id);
		if($uc->uid != $this->user->uid) return Redirect::to('/budget');
		
			View::share('chosen_page','budget');
			View::share('dom_dd',$this->dom_dd);
			$form_data = array('url' => 'budget/'.$id,'class'=>'form well','autocomplete'=>'off','method'=>'PUT');
			foreach($this->nikl_config['uc_classes'] as $key=>$class)
			{
				//echo $key.' '.$uc->class;
				if($class==$uc->class) $the_class = $key;
			}
			return View::make('budget.edit',['uc'=>$uc,'form_data'=>$form_data,'the_class'=>$the_class]);
	}


	/**
	 * Update the specified resource in storage.
	 *
	 * @param  int  $id
	 * @return Response
	 */
	public function update($id)
	{
		$uc = User_category::find($id);
		if($uc->uid != $this->user->uid) return Redirect::to('/budget');
		
		$rules = [
					'category_name' => 'required|between:3,255',
					'top_limit'		=> 'required|numeric',
					'due_date'		=> 'integer',
					'rank'		=> 'integer',
					'class'			=> 'required'
		];

		$validator = Validator::make(Input::all(), $rules);
		if($validator->passes())
		{

			// Gotta store user_category
			$uc->category_name = Input::get('category_name');
			$uc->top_limit = Input::get('top_limit');
			$uc->rank = Input::get('rank');
			if(Input::get('is_archive_feature')) $uc->class = Input::get('class');

			else $uc->class = $this->nikl_config['uc_classes'][Input::get('class')];

			if(Input::get('class')=='credit_card' || Input::get('class') == 10) $uc->due_date = Input::get('due_date');

			$uc->save();

			return Redirect::to('/budget');
		}
		else
		{
			
			return Redirect::to('/budget/'.$id.'/edit')->withErrors($validator)->withInput();
		}
	}


	/**
	 * Remove the specified resource from storage.
	 *
	 * @param  int  $id
	 * @return Response
	 */
	public function destroy($id)
	{
		//
	}

	public function add_bank()
	{
		View::share('chosen_page','budget');
		$form_data = array('url' => 'budget','class'=>'form well','autocomplete'=>'off','method'=>'POST');
		return View::make('budget.add_bank_parent',['form_data'=>$form_data,'the_class'=>'bank_account']);
	}
	public function convert_savings()
	{
		$uc = User_category::find(Input::get('ucid'));
		if($uc->uid != $this->user->uid) return Redirect::to('/budget');

		$saved = $uc->saved;
		$uc->balance = 0.00;
		$uc->saved = 0.00;
		$uc->top_limit = $saved;
		$uc->class = 20; // setting to normal
		$uc->save();
		return Redirect::to('/home');
	}


}
