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
		$form_data = array('url' => 'api/new_entry','class'=>'form well','autocomplete'=>'off','method'=>'POST');
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
		$in = Input::all();
		//dd($in);
		// First, is the date entered manually?
		if(isset($in['using_manual_date'])) $in['date'] = Input::get('date_2');
		else $in['date'] = Input::get('date_1');

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
			if($this->save_entry($in,10)) return Response::json(array('success' => true), 200);
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
