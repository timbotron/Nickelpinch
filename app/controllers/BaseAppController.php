<?php

class BaseAppController extends Controller {

	/**
	 * Setup the layout used by the controller.
	 *
	 * @return void
	 */

	public function __construct()
	{

		$this->currencies = Config::get('nickelpinch.currency_options');
		View::share('currencies',$this->currencies);

		$this->user = User::with(['user_categories'=>function($query)
			{
				$query->orderBy('user_categories.rank','ASC');
			}])->where('users.uid','=',Auth::user()->uid)->get()[0];

		dd($this->user);

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

	protected function setupLayout()
	{
		if ( ! is_null($this->layout))
		{
			$this->layout = View::make($this->layout);
		}
	}

}