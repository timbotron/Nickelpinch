<?php

use Illuminate\Database\Schema\Blueprint;
use Illuminate\Database\Migrations\Migration;

class InitiumTablum extends Migration {

	/**
	 * Run the migrations.
	 *
	 * @return void
	 */
	public function up()
	{
		// we are going to create all the tables here.
		Schema::create('users', function($table)
	    {
	        $table->increments('uid');
	        $table->string('email')->unique();
	        $table->string('username')->unique();
	        $table->string('password');
	        $table->string('remember_token');
	        $table->tinyInteger('rank')->unsigned();
	        $table->tinyInteger('currency')->unsigned();
	        $table->integer('default_pmt_method')->unsigned();
	        $table->timestamps();
	    });

	    Schema::create('password_reminders', function(Blueprint $table)
		{
			$table->string('email')->index();
			$table->string('token')->index();
			$table->timestamp('created_at');
		});

	    Schema::create('user_categories', function($table)
	    {
	        $table->increments('ucid');
	        $table->integer('uid')->unsigned()->index();
	        $table->string('category_name');
	        $table->decimal('balance', 22, 2);
	        $table->decimal('top_limit', 22, 2);
	        $table->decimal('saved', 22, 2);
	        $table->tinyInteger('class')->unsigned(); // this will be in config. 8=bank, 10=cc, 20=normal, 30=savings, 40=external savings, 255=archived
	        $table->tinyInteger('due_date')->unsigned(); // optional, just for when class is 10
	        $table->integer('rank')->unsigned();
	        $table->timestamps();

	        $table->foreign('uid')->references('uid')->on('users');

	    });

	    /* NOT NOW, maybe at a later date. simple description fine for alpha
	    Schema::create('stores', function($table)
	    {
	        $table->increments('sid');
	        $table->integer('uid')->unsigned()->index();
	        $table->string('store_name');

	        $table->foreign('uid')->references('uid')->on('users');

	    });*/

		Schema::create('entries', function($table)
	    {
	        $table->increments('entid');
	        $table->integer('uid')->unsigned()->index();
	        $table->integer('paid_to')->unsigned()->index(); // will cache this for user, where 0->debit card, items from user_categories
	        $table->date('purchase_date');
	        $table->decimal('total_amount', 22, 2);
	        $table->string('description'); //optional
	        $table->tinyInteger('type')->unsigned(); // this will be in config. 10=purchase, 20=move, 30=cc payment, 40=bill

	        $table->foreign('uid')->references('uid')->on('users');
	        //$table->foreign('sid')->references('sid')->on('stores');

	    });

	    Schema::create('entry_sections', function($table)
	    {
	        $table->increments('esid');
	        $table->integer('entid')->unsigned()->index();
	        $table->integer('ucid')->unsigned()->index();
	        $table->decimal('amount', 22, 2);
	        $table->integer('paid_from')->unsigned()->index(); // from 1 = savings or from 2 = balance

	        $table->foreign('entid')->references('entid')->on('entries');
	        $table->foreign('ucid')->references('ucid')->on('user_categories');

	    });

	    
	}

	/**
	 * Reverse the migrations.
	 *
	 * @return void
	 */
	public function down()
	{
		//
		Schema::drop('password_reminders');
		Schema::drop('entry_sections');
		Schema::drop('entries');
		Schema::drop('user_categories');
		Schema::drop('users');
	}

}
