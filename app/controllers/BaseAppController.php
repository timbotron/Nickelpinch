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
		$this->uc_array = array();

		foreach($this->user->user_categories as &$cat)
		{
			$this->uc_array[$cat->ucid] = $cat->category_name;
			if($cat->class == 20)
			{
				// need to set color of category label depending on how much money is left. 0-70 is green. 71-95 yellow, 95+ red
				$tmp = $cat->balance / ($cat->top_limit + $cat->saved);

				$tmp2 = $cat->top_limit - $cat->saved - $cat->balance;

				if($tmp2 > 0)
				{
					$this->remaining_budget += $tmp2;
				}

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

				$this->remaining_budget += $cat->top_limit - $cat->balance;

				if($cat->class == 30) $this->in_saved += $cat->saved;

				if($tmp < 0.75)
				{
					// yellow or green?
					if($tmp < 0.30) $cat->color = $this->red;
					else $cat->color = $this->yellow;
				}
				else $cat->color = $this->green;
			}

			if($cat->class == 10)
			{
				// Is a CC, just need to update remaining_budget
				$this->remaining_budget += $cat->balance;
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

	public function make_dates()
	{
		$ret = array();

		$ret[date('Y-m-d')] = 'Today '.date('(m/d)');
		$ret[date('Y-m-d',strtotime('-1 day'))] = 'Yesterday '.date('(m/d)',strtotime('-1 day'));
		$ret[date('Y-m-d',strtotime('-2 day'))] = date('m/d',strtotime('-2 day'));
		$ret[date('Y-m-d',strtotime('-3 day'))] = date('m/d',strtotime('-3 day'));
		$ret[date('Y-m-d',strtotime('-4 day'))] = date('m/d',strtotime('-4 day'));

		return $ret;
	}

	public function make_paid_via()
	{
		$ret = array();

		$ret = array(	0=>'Debit Card / Check',
						1=>'Cash');
		foreach($this->user->user_categories as $c)
		{
			if($c->class==10) $ret[(int)$c->ucid] = $c->category_name;
		}

		return $ret;
	}

	public function make_all_cats()
	{
		$classes = array('all_wCC','all',10,20,30);
		$returnme = array();
		foreach($classes as $class)
		{
			$ret = array();
			if($class=='all_wCC') $ret[0] = $this->bank_info['name'];
			else $ret[0] = 'Choose..';
			foreach($this->user->user_categories as $c)
			{
				if($class=='all' && ($c->class==20 || $c->class==30)) $ret[(int)$c->ucid] = $c->category_name;
				elseif($class=='all_wCC' && (in_array($c->class, array(10,20,30)))) $ret[(int)$c->ucid] = $c->category_name;
				elseif($c->class==$class) $ret[(int)$c->ucid] = $c->category_name;
			}
			$returnme[$class] = $ret;
			
		}

		return $returnme;
	}

	protected function setupLayout()
	{
		if ( ! is_null($this->layout))
		{
			$this->layout = View::make($this->layout);
		}
	}

}