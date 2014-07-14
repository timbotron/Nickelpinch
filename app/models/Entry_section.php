<?php

class Entry_section extends Eloquent {

    protected $table = 'entry_sections';

    protected $primaryKey = "esid";

    public function entry()
    {
    	return $this->belongsTo('Entry','eid','eid');
    }


}
