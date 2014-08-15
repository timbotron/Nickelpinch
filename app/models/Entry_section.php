<?php

class Entry_section extends Eloquent {

    protected $table = 'entry_sections';

    protected $primaryKey = "esid";

    public $timestamps = false;

    public function entry()
    {
    	return $this->belongsTo('Entry','eid','eid');
    }


}
