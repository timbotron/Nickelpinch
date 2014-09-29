<?php

class HistoryController extends BaseAppController {


	public function __construct()
	{
		parent::__construct();
		$this->days = $this->make_dates();
		$this->paid_via = $this->make_paid_via();
		$this->all_cats_dd = $this->make_all_cats();
	}

	public function index($target=-1,$range=30)
	{
		View::share('chosen_page','history');
		if($target != -1)	$history = Entry::history_for($target,$range);
		else
		{
			$history = false;
			$target_name = 0;
		} 

		// we need the current target name
		//dd($this->user->user_categories);
		foreach($this->user->user_categories as $uc)
		{
			if($uc->ucid == $target) $target_name = $uc->category_name;
		}
		if($target==0) $target_name = $this->bank_info['name'];

		//dd($this->bank_info);
		$dates_dd = array(30=>'30 Days',
							90 => '90 Days',
							180 => '180 Days',
							1000 => 'All');
		$form_data = array(
							'class'=>'form well form-inline redirect-me',
							'autocomplete'=>'off',
							'method'=>'GET');
		return View::make('history.main',['form_data'=>$form_data,
										'target_cat'=>$target,
										'target_range'=>$range,
										'target_name'=>$target_name,
										'history'=>$history,
										'dates'=>$this->days,	
										'paid_with'=>$this->paid_via,
										'cats_dd'=>$this->all_cats_dd['all_wCC'],
										'date_range_dd'=>$dates_dd
										]);
	}

}