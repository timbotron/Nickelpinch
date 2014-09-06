<?php

class EntryController extends BaseAppController {


	public function __construct()
	{
		parent::__construct();
		$this->days = $this->make_dates();
		$this->paid_via = $this->make_paid_via();
		$this->all_cats_dd = $this->make_all_cats();


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

		$ret = array(	0=>'Debit Card / Check',
						1=>'Cash');
		foreach($this->user->user_categories as $c)
		{
			if($c->class==10) $ret[(int)$c->ucid] = $c->category_name;
		}

		return $ret;
	}

	private function make_all_cats()
	{
		$classes = array('all',10,20,30);
		$returnme = array();
		foreach($classes as $class)
		{
			$ret = array();
			$ret[0] = 'Choose..';
			foreach($this->user->user_categories as $c)
			{
				if($class=='all' && ($c->class==20 || $c->class==30)) $ret[(int)$c->ucid] = $c->category_name;
				elseif($c->class==$class) $ret[(int)$c->ucid] = $c->category_name;
			}
			$returnme[$class] = $ret;
			
		}

		return $returnme;
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
	 * Show the form for adding an entry
	 *
	 * @return Response
	 */
	public function create($target = 0)
	{
		
		View::share('chosen_page','none');
		$form_data = array('url' => 'api/new_entry/10',
							'class'=>'form well ajax-me',
							'data-id'=>'entry',
							'data-target'=>'/home',
							'autocomplete'=>'off',
							'method'=>'POST');
		return View::make('entry.main',['form_data'=>$form_data,
										'target_cat'=>$target,
										'dates'=>$this->days,	
										'paid_with'=>$this->paid_via,
										'cats_dd'=>$this->all_cats_dd[20]
										]);
		
	}

	/**
	 * Show the form for moving
	 *
	 * @return Response
	 */
	public function move()
	{
		
		View::share('chosen_page','none');
		$form_data = array('url' => 'api/new_entry/40',
							'class'=>'form well ajax-me',
							'data-id'=>'entry',
							'data-target'=>'/home',
							'autocomplete'=>'off',
							'method'=>'POST');
		return View::make('entry.move',['form_data'=>$form_data,
										'dates'=>$this->days,	
										'paid_with'=>$this->all_cats_dd['all'],
										'cats_dd'=>$this->all_cats_dd['all']
										]);
		
	}

	/**
	 * Show the form for saving money to a savings category
	 *
	 * @return Response
	 */
	public function save($target = 0)
	{
		
		View::share('chosen_page','none');
		$form_data = array('url' => 'api/new_entry/20',
							'class'=>'form well ajax-me',
							'data-id'=>'entry',
							'data-target'=>'/home',
							'autocomplete'=>'off',
							'method'=>'POST');
		return View::make('entry.save',['form_data'=>$form_data,
										'target_cat'=>$target,
										'dates'=>$this->days,	
										'cats_dd'=>$this->all_cats_dd[30]
										]);
		
	}

	/**
	 * Show the form for withdrawing from a user category or depositing
	 *
	 * @return Response
	 */
	public function inout()
	{
		
		View::share('chosen_page','none');
		$form_data = array('url' => 'api/new_entry/70',
							'class'=>'form well ajax-me',
							'data-id'=>'entry',
							'data-target'=>'/home',
							'autocomplete'=>'off',
							'method'=>'POST');
		return View::make('entry.inout',['form_data'=>$form_data,
										'dates'=>$this->days,	
										'chosen_page'=>'inout',	
										'cats_dd'=>$this->all_cats_dd['all']
										]);
		
	}

	/**
	 * Show the form for Paying a CC Bill
	 *
	 * @return Response
	 */
	public function paycc($target=0)
	{
		
		View::share('chosen_page','none');
		$form_data = array('url' => 'api/new_entry/50',
							'class'=>'form well ajax-me',
							'data-id'=>'entry',
							'data-target'=>'/home',
							'autocomplete'=>'off',
							'method'=>'POST');
		return View::make('entry.paycc',['form_data'=>$form_data,
										'target_cat'=>$target,
										'dates'=>$this->days,	
										'cats_dd'=>$this->all_cats_dd[10]
										]);
		
	}


	/**
	 * Store a newly created resource in storage.
	 *
	 * @return Response
	 */
	public function store($type=10)
	{
		$in = Input::all();
		//dd($in);
		// First, is the date entered manually?
		if(isset($in['using_manual_date'])) $in['date'] = Input::get('date_2');
		else $in['date'] = Input::get('date_1');

		if($type==10)
		{
			$rules = [
					'amount' 		=> 'required|numeric',
					'paid_to' 		=> 'required|numeric',
					'date'		=> 'required|date'
				];
			// is multi-category purchase?
			if(Input::has('using_multi_cats'))
			{
				// we need to be sure the sum of the cats match the amount
				$total = 0;
				if(Input::has('cat_1'))
				{
					$rules['cat_1'] = 'numeric';
					$total += $in['cat_1_val'];
				}
				if(Input::has('cat_2'))
				{
					$rules['cat_2'] = 'numeric';
					$total += $in['cat_2_val'];
				}
				if(Input::has('cat_3'))
				{
					$rules['cat_3'] = 'numeric';
					$total += $in['cat_3_val'];
				}

				if($total==0)
				{
					return Response::json(array('status' => false, 'errors' => array('total'=>'When adding a multi-category purchase, you must have amounts for each category you choose.')), 400);
				}
				elseif($total!=$in['amount'])
				{
					return Response::json(array('status' => false, 'errors' => array('total'=>'When adding a multi-category purchase, the amounts set in the categories must add up to the total amount of the purchase.')), 400);
				}
			}
			else
			{
				$rules['cat_1'] = 'required|numeric';
			}

		}
		elseif($type==20) // savings entry
		{
			$rules = [
					'amount' 	=> 'required|numeric',
					'date'		=> 'required|date',
					'cat_1' 	=> 'required|numeric'
				];
			
		}
		elseif($type==70) // deposit or withdraw entry
		{
			$rules = [
					'the_class'		=> 'required|numeric',
					'amount' 		=> 'required|numeric',
					'date'			=> 'required|date'
				];

			if($in['cat_1']==80) $rules['cat_1'] = 'required|numeric|min:1';
			else $rules['cat_1'] = 'required|numeric';
			
		}
		elseif($type==50) // CC Payment
		{
			$rules = [
					'amount' 		=> 'required|numeric',
					'date'			=> 'required|date',
					'cat_1' 		=> 'required|numeric'
				];
			
			
		}
		elseif($type==40)
		{
			$rules = [
					'amount' 		=> 'required|numeric',
					'paid_to' 		=> 'required|numeric',
					'date'		=> 'required|date',
					'cat_1' 		=> 'required|numeric'
				];
		}

		$validator = Validator::make($in,$rules);

		if ($validator->fails())
		{
		    return Response::json(array(
		        'success' => false,
		        'errors' => $validator->getMessageBag()->toArray()
		    ), 400); // 400 being the HTTP code for an invalid request.
		}
		else
		{
			if($this->save_entry($in,$type)) return Response::json(array('success' => true), 200);
			else
			{
				 return Response::json(array(
			        'success' => false,
			        'errors' => array('saving'=>'There was a problem saving this entry.')
			    ), 400); // 400 being the HTTP code for an invalid request.
			}
		}

		
		

	}

	private function save_entry($in,$type=10)
	{
		if($type==10) // new entry
		{
			// first we save the entry
			$e = new Entry;
			$e->uid = $this->user->uid;
			$e->paid_to = $in['paid_to'];
			$e->purchase_date = $in['date'];
			$e->total_amount = $in['amount'];
			$e->description = $in['description'];
			$e->type = $type;
			$e->save();


			$this->do_the_math($e->paid_to,$e->total_amount,$e->purchase_date,1);

			//Then we update the uc total


			// now we save the entry_section(s)
			// is this a multi-cat purchase?
			if(isset($in['using_multi_cats']))
			{
				// do multi
				for($i=1;$i<4;$i++)
				{
					if($in['cat_'.$i]!='0')
					{

						$es = new Entry_section;
						$es->ucid = $in['cat_'.$i];
						$es->entid = $e->entid;
						$es->amount = $in['cat_'.$i.'_val'];
						$es->save();

						// now we do math
						$this->do_the_math($es->ucid,$es->amount,$e->purchase_date,0);

						
					}
				}
			}
			else
			{
				// single
				$es = new Entry_section;
				$es->ucid = $in['cat_1'];
				$es->entid = $e->entid;
				$es->amount = $in['amount'];
				$es->save();

				// now we do math
				$this->do_the_math($es->ucid,$es->amount,$e->purchase_date,0);

				
			}
		return true;	
		}
		elseif($type==20)
		{
			// first we save the entry
			$e = new Entry;
			$e->uid = $this->user->uid;
			$e->paid_to = $in['cat_1'];
			$e->purchase_date = $in['date'];
			$e->total_amount = $in['amount'];
			$e->description = $in['description'];
			$e->type = $type;
			$e->save();


			$this->do_the_math($e->paid_to,$e->total_amount,$e->purchase_date,1);

			return true;	
		}
		elseif($type==70) // deposit / withdraw
		{
			// first we save the entry
			$e = new Entry;
			$e->uid = $this->user->uid;
			if($in['the_class'] == 70) $e->paid_to = $this->bank_info['ucid']; // a deposit
			else $e->paid_to = 0; // a withdraw
			$e->purchase_date = $in['date'];
			$e->total_amount = $in['amount'];
			$e->description = $in['description'];
			$e->type = $type;
			$e->save();


			$this->do_the_math($e->paid_to,$e->total_amount,$e->purchase_date,1);

			// if this is a withdraw, we need to reduce the uc it came from so need an entry_section
			if($e->paid_to==0)
			{
				$es = new Entry_section;
				$es->ucid = $in['cat_1'];
				$es->entid = $e->entid;
				$es->amount = $in['amount'];
				$es->save();

				// now we do math
				$this->do_the_math($es->ucid,$es->amount,$e->purchase_date,0);
			}

			
			return true;	
		}
		elseif($type==50) // CC Payment
		{
			// first we save the entry
			$e = new Entry;
			$e->uid = $this->user->uid;
			$e->paid_to = 0; 
			$e->purchase_date = $in['date'];
			$e->total_amount = $in['amount'];
			$e->description = $in['description'];
			$e->type = $type;
			$e->save();


			$this->do_the_math($e->paid_to,$e->total_amount,$e->purchase_date,1);

			// Reduce the CC balance by the amount
			$es = new Entry_section;
			$es->ucid = $in['cat_1'];
			$es->entid = $e->entid;
			$es->amount = $in['amount'];
			$es->save();
			// now we do math
			$this->do_the_math($es->ucid,$es->amount,$e->purchase_date,0);
			

			
			return true;	
		}
		elseif($type==40) // Move
		{
			// first we save the entry
			$e = new Entry;
			$e->uid = $this->user->uid;
			$e->paid_to = $in['paid_to']; 
			$e->purchase_date = $in['date'];
			$e->total_amount = $in['amount'];
			$e->description = $in['description'];
			$e->type = $type;
			$e->save();



			$this->do_the_math($e->paid_to,$e->total_amount,$e->purchase_date,1);

			// Reduce the From by the amount
			$es = new Entry_section;
			$es->ucid = $in['cat_1'];
			$es->entid = $e->entid;
			$es->amount = $in['amount'];
			$es->save();
			// now we do math
			$this->do_the_math($es->ucid,$es->amount,$e->purchase_date,0,1);
			

			
			return true;	
		}
		
	}

	/*
	USE CASES:
	!! first need to make sure entry happened in current month.
	* user buys food, cc, from food uc.
		* food balance incremented by amt.
		* if food has savings, subtract from that.
			* if reserved greater than amt, just subtract.
			* elif reserved less than amt, set reserved to 0
		* cc incremented by amt
	* User goes to costco, spends 100 on debit, 80 food 20 fun.
		* 100 subtracted from bank balance
		* 80 added to food balance
		* if food has savings, subtract from that.
			* if reserved greater than amt, just subtract.
			* elif reserved less than amt, set reserved to 0
		* 20 added to fun balance
		* if fun has savings, subtract from that.
			* if reserved greater than amt, just subtract.
			* elif reserved less than amt, set reserved to 0
	* User goes to candy store, spends 4 cash from food
		* 4 added to food balance
		* if food has savings, subtract from that.
			* if reserved greater than amt, just subtract.
			* elif reserved less than amt, set reserved to 0

	*/

	private function do_the_math($ucid,$total,$date,$is_add,$is_move=0)
	{
		if($ucid>1)
		{
			$uc = User_category::find($ucid);

			if($is_add)
			{
				switch ($uc->class) 
				{
					case 8:
					case 10:
						// Is a CC or Bank Account
						$uc->balance = $uc->balance + $total;
						break;
					case 20:
						// Is a normal acct
						$uc->saved = $uc->saved + $total;
						break;
					case 30:
					case 40:
						// Is a savings or external savings
						$uc->balance = $uc->balance + $total;
						$uc->saved = $uc->saved + $total;
						break;
				}
				
			}
			else
			{
				switch ($uc->class) 
				{
					case 8:
					case 10:
						// Is a CC or Bank Account
						$uc->balance = $uc->balance - $total;
						break;
					case 20:
						// Is a normal acct
						if($uc->saved>0)
						{
							if($uc->saved>=$total) $uc->saved = $uc->saved - $total;
							else $uc->saved  = 0.00;
						}
						if(!$is_move && (date('m-Y') == date('m-Y',strtotime($date)))) $uc->balance = $uc->balance + $total;
						break;
					case 30:
					case 40:
						// Is a savings or external savings
						if($uc->saved>0)
						{
							if($uc->saved>=$total) $uc->saved = $uc->saved - $total;
							else $uc->saved  = 0.00;
						}
						break;
				}
			}
			$uc->save();
		}
		else
		{
			
			// means someone bought something with debit/cash or a withdraw
			// Doesn't matter if add or not, same thing happens.
			if($ucid==0)
			{
				// means debit / check / withdraw, so need to reduce the bank balance
				$uc = User_category::find($this->bank_info['ucid']);
				$uc->balance = $uc->balance - $total;
				$uc->save();
			}
			
		}

		
		

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
