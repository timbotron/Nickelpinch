<?php

class EntryController extends BaseAppController {


	public function __construct()
	{
		parent::__construct();
		$this->days = $this->make_dates();
		$this->paid_via = $this->make_paid_via();
		$this->cats_dd = $this->make_cats_dd();
		//dd($this->cats_dd);


	}

	private function make_dates()
	{
		$ret = array();

		$ret[date('Y-m-d')] = 'Today '.date('(m/d)');
		$ret[date('Y-m-d',strtotime('-1 day'))] = 'Yesterday '.date('(m/d)',strtotime('-1 day'));
		$ret[date('Y-m-d',strtotime('-2 day'))] = date('m/d',strtotime('-2 day'));
		$ret[date('Y-m-d',strtotime('-3 day'))] = date('m/d',strtotime('-3 day'));
		$ret[date('Y-m-d',strtotime('-4 day'))] = date('m/d',strtotime('-4 day'));

		return $ret;
	}

	private function make_paid_via()
	{
		$ret = array();

		$ret = array(	0=>'Debit Card',
						1=>'Cash',
						2=>'Check');
		foreach($this->user->user_categories as $c)
		{
			if($c->class==10) $ret[(int)$c->ucid] = $c->category_name;
		}

		return $ret;
	}

	private function make_cats_dd()
	{
		$ret = array();
		$ret[0] = 'Choose..';

		foreach($this->user->user_categories as $c)
		{
			if($c->class==20) $ret[(int)$c->ucid] = $c->category_name;
		}

		return $ret;
	}

	/**
	 * Display a listing of the resource.
	 *
	 * @return Response
	 */
	public function index()
	{
		//
	}


	/**
	 * Show the form for creating a new resource.
	 *
	 * @return Response
	 */
	public function create($target = 0)
	{
		
		View::share('chosen_page','move');
		$form_data = array('url' => 'entry/add','class'=>'form well','autocomplete'=>'off','method'=>'POST');
		return View::make('entry.main',['form_data'=>$form_data,
										'target_cat'=>$target,
										'the_class'=>'standard',
										'dates'=>$this->days,
										'paid_with'=>$this->paid_via,
										'cats_dd'=>$this->cats_dd
										]);
		
	}


	/**
	 * Store a newly created resource in storage.
	 *
	 * @return Response
	 */
	public function store()
	{
		//
	}


	/**
	 * Display the specified resource.
	 *
	 * @param  int  $id
	 * @return Response
	 */
	public function show($id)
	{
		//
	}


	/**
	 * Show the form for editing the specified resource.
	 *
	 * @param  int  $id
	 * @return Response
	 */
	public function edit($id)
	{
		//
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
