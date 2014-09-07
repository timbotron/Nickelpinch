<?php

class HistoryController extends BaseAppController {


	public function __construct()
	{
		parent::__construct();
		$this->days = $this->make_dates();
		$this->paid_via = $this->make_paid_via();
		$this->all_cats_dd = $this->make_all_cats();
	}

	public function index($target=0)
	{
		View::share('chosen_page','history');
		$history = Entry::history_for($target,30);

		// we need the current target name
		//dd($this->user->user_categories);
		foreach($this->user->user_categories as $uc)
		{
			if($uc->ucid == $target) $target_name = $uc->category_name;
		}
		$form_data = array(
							'class'=>'form well form-inline redirect-me',
							'autocomplete'=>'off',
							'method'=>'GET');
		return View::make('history.main',['form_data'=>$form_data,
										'target_cat'=>$target,
										'target_name'=>$target_name,
										'history'=>$history,
										'dates'=>$this->days,	
										'paid_with'=>$this->paid_via,
										'cats_dd'=>$this->all_cats_dd['all_wCC']
										]);
	}

}