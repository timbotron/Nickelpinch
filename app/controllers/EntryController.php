<?php

class EntryController extends BaseAppController {


	public function __construct()
	{
		parent::__construct();
		$this->days = $this->make_dates();
		$this->paid_via = $this->make_paid_via();
		$this->all_cats_dd = $this->make_all_cats();


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
										'cats_dd'=>$this->all_cats_dd['all']
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
										'paid_with'=>$this->all_cats_dd['all_wCC'],
										'cats_dd'=>$this->all_cats_dd['all_wCC']
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
										'cats_dd'=>$this->all_cats_dd['all_wCC']
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
		elseif($type==70) // deposit or withdraw entry
		{
			$rules = [
					'the_class'		=> 'required|numeric',
					'amount' 		=> 'required|numeric',
					'date'			=> 'required|date'
				];

			if($in['cat_1']==80) $rules['cat_1'] = 'required|numeric|min:1';
			else $rules['cat_1'] = 'required|numeric';

			$type = $in['the_class'];
			
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

	private function spent_from_uc($ucid,$amount) {
		$uc = User_category::find($eucid);
		$uc->balance = $uc->balance + $amount;
		$uc->save();
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

			// Now we alter the user category amounts to reflect the entry

			// First, lets alter amounts for where the money is going TO
			$uc = User_category::find($e->paid_to);
			switch($uc->class) {
				case 8:
					// Is Bank Account
					$uc->balance = $uc->balance - $e->total_amount;
					break;
				case 10:
					// Is a CC
					$uc->balance = $uc->balance + $e->total_amount;
					break;
				case 20:
					// Is a normal acct
					$uc->saved = $uc->saved + $e->total_amount;
					break;
			}
			$uc->save();
			unset($uc);

			// Now, lets alter amounts for where the money is coming FROM
			// is this a multi-cat purchase?
			if(isset($in['using_multi_cats']))
			{
				// do multi
				for($i=1;$i<4;$i++)
				{
					if($in['cat_'.$i]!='0')
					{
						$this->spent_from_uc($in['cat_'.$i],$in['cat_'.$i.'_val']);
					}
				}
			}
			else
			{
				// single
				$this->spent_from_uc($in['cat_1'],$in['amount']);
			}
		return true;	
		}
		elseif($type==70 || $type == 80) // deposit / withdraw
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

			$dep_or_with = 0;
			if($in['the_class'] == 70)
			{
				$dep_or_with = 1;
			}


			$this->do_the_math($e->entid,$e->paid_to,$e->total_amount,$e->purchase_date,$dep_or_with);

			// if this is a withdraw, we need to reduce the uc it came from so need an entry_section
			if($e->paid_to==0 && ($this->bank_info['ucid'] != $in['cat_1']))
			{
				$es = new Entry_section;
				$es->ucid = $in['cat_1'];
				$es->entid = $e->entid;
				$es->amount = $in['amount'];
				$es->save();

				// now we do math
				$this->do_the_math($e->entid,$es->ucid,$es->amount,$e->purchase_date,0);
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


			$this->do_the_math($e->entid,$e->paid_to,$e->total_amount,$e->purchase_date,0);

			// Reduce the CC balance by the amount
			$this->save_entry_section($in['cat_1'],$e->entid,1,$in['amount']);
			// now we do math
			$this->do_the_math($e->entid,$in['cat_1'],$in['amount'],$e->purchase_date,0);
			

			
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



			$this->do_the_math($e->entid,$e->paid_to,$e->total_amount,$e->purchase_date,1,1);

			// Reduce the From by the amount
			$this->save_entry_section($in['cat_1'],$e->entid,2,$in['amount']);
			// now we do math
			$this->do_the_math($e->entid,$in['cat_1'],$in['amount'],$e->purchase_date,0,1);
			

			
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

	private function save_entry_section($ucid,$entid,$paid_from,$amount)
	{
		$es = new Entry_section;
		$es->ucid = $ucid;
		$es->entid = $entid;
		$es->paid_from = $paid_from;
		$es->amount = $amount;
		$es->save();
	}

	private function add_to_uc($ucid,$amount,$date,$entid) {
		
	}

	private function do_the_math($entid,$ucid,$total,$date,$is_add,$is_move=0,$is_delete=0,$paid_from=0,$entry_type=0)
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
						if(!$is_delete) $uc->saved = $uc->saved + $total;
						else // is delete
						{
							// means its in same month; we need to actually reduce the balance
							if(date('m-Y') == date('m-Y',strtotime($date)))
							{
								$uc->balance = $uc->balance - $total;
							}
							else
							{
								$uc->saved = $uc->saved + $total;
							}
						}
						
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
						if($is_delete) {
							// wil lhappen
						}
						else {
							$this->save_entry_section($ucid,$entid,2,$total);
							if((date('m-Y') == date('m-Y',strtotime($date)))) {
								$uc->balance = $uc->balance + $total;
							}

						}
						
						break;
				}
			}
			$uc->save();
		}
		else
		{
			// means someone bought something with debit/cash or a withdraw
			if($ucid==0)
			{
				$uc = User_category::find($this->bank_info['ucid']);

				if($is_add)
				{
					$uc->balance = $uc->balance + $total;
					$uc->save();
				}
				else
				{
					// means debit / check / withdraw, so need to reduce the bank balance
					
					$uc->balance = $uc->balance - $total;
					$uc->save();
				}
				
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
		$entry = Entry::where('entid','=',$id)->with('section')->get()->toArray();
		

		// does user have access?
		if($entry[0]['uid'] != $this->user->uid)
		{
			return Response::json(array('status' => false, 'errors' => array('total'=>'You are not authorized to view this entry.')), 400);
		}
		else
		{
			foreach($entry as &$e)
			{
				// gotta make data nicer
				if($e['paid_to']==0) $e['paid_to'] = 'Debit/Credit';
				else $e['paid_to'] = $this->uc_array[$e['paid_to']];
				$e['purchase_date'] = date('M j, Y',strtotime($e['purchase_date']));
				$e['type'] = $this->nikl_config['entry_types'][$e['type']];
				foreach($e['section'] as &$s)
				{
					if($s['ucid']==0) $s['ucid'] = 'Debit/Check';
					else $s['ucid'] = $this->uc_array[$s['ucid']];
				}
			}
			return Response::json($entry);
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
		$entry = Entry::where('entid','=',$id)->with('section')->get();

		//dd($entry[0]);

		// does user have access?
		if($entry[0]->uid != $this->user->uid)
		{
			return Response::json(array('status' => false, 'errors' => array('total'=>'You are not authorized to delete this entry.')), 400);
		}

		//dd($entry[0]);

		if(Entry::delete_entry($id))
		{
			if($entry[0]->type==100)
			{
				// SPECIAL CASE; deleting a monthly reset.
				$tmp = [];
				foreach($entry[0]->section as $es)
				{
					$tmp['balance'] = $es->amount;
					DB::table('user_categories')->where('ucid',$es->ucid)->update($tmp);
				}
				return Response::json(array('success' => true), 200); 

			}
			// first do reverse math on entry
			// fun stuff; if its a cc entry we're reversing, gotta be funky because I am a moron and did the
			// stupid ucid = 0 for everyones bank instead of just having an extra row for each user.
			$is_add = 0;
			if($entry[0]->type==50 || ($entry[0]->type==10 && $entry[0]->paid_to==0))
			{
				$is_add = 1;
			}
			$this->do_the_math(
								$id,
								$entry[0]->paid_to,
								$entry[0]->total_amount,
								$entry[0]->purchase_date,
								$is_add,
								0,
								1); 

			// Then for each entry section
			foreach($entry[0]->section as $es)
			{
				$this->do_the_math(			// TODO need to deal with deleting if its from savings, want to add to saved but thats it
									$id,
									$es->ucid,
									$es->amount,
									$entry[0]->purchase_date,
									1,
									0,
									1,
									$es->paid_from,
									$entry[0]->type); 

			}
			return Response::json(array('success' => true), 200); 
		}
		else
		{
			return Response::json(array('status' => false, 'errors' => array('total'=>'There was a problem deleting this entry.')), 400);
		}
	}

	public function cat_reset()
	{
		// This is a big one. Reset all the categories balances to 0 and does it in an
		// entry style, so it can be reversed.

		try
        {
            DB::transaction(function()
            {
            	// first we save the monthly resetentry
				$e = new Entry;
				$e->uid = $this->user->uid;
				$e->paid_to = 0; 
				$e->purchase_date = date('Y-m-d');
				$e->total_amount = 0;
				$e->description = 'Monthly Reset for '.date('M Y');
				$e->type = 100;
				$e->save();
                foreach($this->user->user_categories as $uc)
				{
					$tmp = [];
					if(in_array($uc->class, [20,30]))
					{
						$this->save_entry_section($uc->ucid,$e->entid,2,$uc->balance);

						if($uc->class == 20) {
							// we need to see if we need to alter overflow amt

							if($uc->balance < $uc->top_limit) {
								$uc->saved += ($uc->top_limit - $uc->balance);
							}
							else { // means spent more than what we budgeted for, we need to reduce the saved if there is some
								if($uc->saved > 0) {
									if(($uc->balance - $uc->top_limit) > $uc->saved) {
										$uc->saved = 0.00;
									}
									else {
										$uc->saved = $uc->saved - ($uc->balance - $uc->top_limit);
									}
								}
							}
							$tmp = ['balance' => 0.00, 'saved' => $uc->saved];
						}
						else {
							// set balance to 0 and save uc
							$tmp['balance'] = 0.00;
							
						}
						DB::table('user_categories')->where('ucid',$uc->ucid)->update($tmp);
						
					}
				}

            });
        }
        catch(Exception $e)
        {
        	//dd($e->getMessage());
            return Response::json(array('status' => false, 'errors' => array('total'=>'There was a problem with the categories reset.')), 400);
        }
        return Response::json(array('success' => true), 200);

		
	}


}
