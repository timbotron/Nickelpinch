<?php

class User_category extends Eloquent {

    protected $table = 'user_categories';

    protected $primaryKey = "ucid";

    public function user()
    {
    	return $this->belongsTo('User','uid','uid');
    }

}
