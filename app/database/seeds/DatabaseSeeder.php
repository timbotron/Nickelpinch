<?php

class DatabaseSeeder extends Seeder {

	/**
	 * Run the database seeds.
	 *
	 * @return void
	 */
	public function run()
	{
		Eloquent::unguard();

		$this->call('UserTableSeeder');
		$this->call('UserCategoriesTableSeeder');
	}

}

class UserTableSeeder extends Seeder {

    public function run()
    {
        DB::table('users')->delete();

        User::create(['email' => 'foo@bar.com','username'=>'user1','rank'=>10,'currency'=>0,'password'=>Hash::make('pass')]);
    }

}

class UserCategoriesTableSeeder extends Seeder {

    public function run()
    {
        DB::table('user_categories')->delete();

        User_category::create(['uid'=>1,'category_name'=>'default fill','balance'=>0.00,'top_limit'=>0.00,'saved'=>0.00,'class'=>255,'rank'=>1000]);
    }

}