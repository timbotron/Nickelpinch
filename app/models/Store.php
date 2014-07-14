<?php

class Store extends Eloquent {

    protected $table = 'stores';

    protected $primaryKey = "sid";

    public function user()
    {
    	return $this->belongsTo('User','uid','uid');
    }

}
