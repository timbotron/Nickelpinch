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
		return View::make('budget.index');
	}


	/**
	 * Store a newly created resource in storage.
	 *
	 * @return Response
	 */
	public function store()
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
		
		$rules = [
					'category_name' => 'required|between:4,255',
					'top_limit'		=> 'required|numeric',
					'due_date'		=> 'integer',
					'rank'		=> 'integer',
					'class'			=> 'required'
		];

		$validator = Validator::make(Input::all(), $rules);
		if($validator->passes())
		{

			// Gotta store user_category
			$uc = User_category::find($ucid);
			if($uc->uid != $this->user->uid) return Redirect::to('/budget');

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


	/**
	 * Update the specified resource in storage.
	 *
	 * @param  int  $id
	 * @return Response
	 */
	public function update($id)
	{
		//
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


}
