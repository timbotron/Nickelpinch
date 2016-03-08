<?php

return array(

	/*
	|--------------------------------------------------------------------------
	| Nickelpinch Config File
	|--------------------------------------------------------------------------
	|
	| All the Nickelpinch configuration items go here.
	|
	*/

	/*
	|--------------------------------------------------------------------------
	| Accepting Signups
	|--------------------------------------------------------------------------
	|
	| Do we want to allow new users to signup? 
	|
	*/

	'gate_open'=>true,

	/*
	|--------------------------------------------------------------------------
	| Ranks
	|--------------------------------------------------------------------------
	|
	| list of all possible ranks, and default rank
	|
	*/

	'ranks'	=> array(
			0	=> 'Inactive User',
			10	=> 'Free User',
			20	=> 'Premium User',
			255 => 'Administrator',
	),
	'default_rank'	=> 10,

	/*
	|--------------------------------------------------------------------------
	| Currencies
	|--------------------------------------------------------------------------
	*/

	'currency_options'=> array(
		0 => '&#36;',   // USD
		1 => '&#128;',	// EURO
		2 => '&#163;',  // GBP
		3 => '&#165;',	// YEN
	),
	'default_currency' => 0,

	/*
	|--------------------------------------------------------------------------
	| User Category Classes
	|--------------------------------------------------------------------------
	*/

	'uc_classes' => array(
		'bank_account'=>8,
		'credit_card'=>10,
		'standard'=>20,
		'archived'=>255
		),

	'uc_class_def' => array(
		10 => 'Credit Card',
		20 => 'Standard',
		255 => 'Archived'
		),

	'entry_types' => array(
		10 => 'Purchase',
		40 => 'Move',
		50 => 'CC Payment',
		//60 => 'Bill',
		70 => 'Deposit',
		80 => 'Withdraw',
		100 => 'Monthly Reset'
		)



	);