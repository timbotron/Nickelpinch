<?php

class Entry extends Eloquent {

    protected $table = 'entries';

    protected $primaryKey = "entid";

    public function section()
    {
    	return $this->hasMany('Entry_section','entid','entid');
    }

    public function user()
    {
    	return $this->belongsTo('User','uid','uid');
    }

}
