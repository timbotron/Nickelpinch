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

		$this->bank_info = false;

		$this->green = 'label label-success';
		$this->yellow = 'label label-warning';
		$this->red = 'label label-danger';

		foreach($this->user->user_categories as &$cat)
		{
			if($cat->class != 8 && $cat->class != 255)
			{
				// need to set color of category label depending on how much money is left. 0-70 is green. 71-95 yellow, 95+ red
				$tmp = ($cat->balance + $cat->saved) / $cat->top_limit;

				if($tmp < 1)
				{
					// yellow or green?
					if($tmp < 0.75) $cat->color = $this->green;
					else $cat->color = $this->yellow;
				}
				else $cat->color = $this->red;


				if($cat->class == 8)
				{
					$this->bank_info = array();
					$this->bank_info['name'] = $cat->category_name;
					$this->bank_info['balance'] = $cat->balance;
				}
			}
			
		}
		dd($this->user->user_categories);

		View::share('bank_info',$this->bank_info);
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