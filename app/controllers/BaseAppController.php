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

		$this->budget_needs = 0;
		$this->remaining_budget = 0;
		$this->in_saved = 0;

		foreach($this->user->user_categories as &$cat)
		{
			if($cat->class == 20)
			{
				// need to set color of category label depending on how much money is left. 0-70 is green. 71-95 yellow, 95+ red
				$tmp = ($cat->balance + $cat->saved) / $cat->top_limit;

				$this->remaining_budget += $cat->top_limit - $cat->saved - $cat->balance;

				$this->in_saved += $cat->saved;

				if($tmp < 1)
				{
					// yellow or green?
					if($tmp < 0.75) $cat->color = $this->green;
					else $cat->color = $this->yellow;
				}
				else $cat->color = $this->red;
				
			}

			if($cat->class == 40 || $cat->class == 30)
			{
				// need to set color of category label depending on how much money is left to save. 0-30 is red. 31-75 yellow, 76+ green
				$tmp = $cat->balance / $cat->top_limit;

				$this->remaining_budget += $cat->top_limit - $cat->saved;

				if($cat->class == 30) $this->in_saved += $cat->saved;

				if($tmp < 0.75)
				{
					// yellow or green?
					if($tmp < 0.30) $cat->color = $this->red;
					else $cat->color = $this->yellow;
				}
				else $cat->color = $this->green;
			}

			if($cat->class == 8)
			{
				$this->bank_info = array();
				$this->bank_info['name'] = $cat->category_name;
				$this->bank_info['balance'] = $cat->balance;
				$this->bank_info['ucid'] = $cat->ucid;
			}
			
		}

		if($this->bank_info)
		{
			$this->bank_info['remaining_budget'] = $this->remaining_budget;
			$this->bank_info['in_saved'] = $this->in_saved;
			$tmp = 0;
			$tmp = $this->bank_info['balance'] - $this->remaining_budget - $this->in_saved;

			$this->bank_info['remaining'] = $tmp;
		}

		$this->nikl_config = Config::get('nickelpinch');

		View::share('bank_info',$this->bank_info);
		View::share('user_data',$this->user);
		View::share('currency',$this->nikl_config['currency_options'][$this->user->currency]);

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