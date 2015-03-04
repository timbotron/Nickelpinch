<?php

class Entry extends Eloquent {

    protected $table = 'entries';

    protected $primaryKey = "entid";

    public $timestamps = false;

    public function section()
    {
    	return $this->hasMany('Entry_section','entid','entid');
    }

    public function user()
    {
    	return $this->belongsTo('User','uid','uid');
    }
    public static function history_for($ucid, $day_range=30)
    {
        $day_range++;
        $sql = "SELECT entries.entid,
                        entries.type,
                        entries.paid_to,
                        entries.description,
                        entries.purchase_date,
                        entries.total_amount,
                        entry_sections.amount,
                        entry_sections.ucid
                FROM entries
                LEFT JOIN entry_sections ON entries.entid=entry_sections.entid
                WHERE (entries.paid_to = ? OR entry_sections.ucid = ?) AND purchase_date >= (NOW() - INTERVAL ? DAY) GROUP BY entries.entid ORDER BY purchase_date DESC";
        return DB::select($sql,array($ucid,$ucid,$day_range));
    }

    public static function delete_entry($entid)
    {
        try
        {
            DB::transaction(function() use ($entid)
            {
                //DB::select('SELECT * from entries where entid=?',array($entid));

                // destroy entry_sections w/this entid
                DB::table('entry_sections')->where('entid','=',$entid)->delete();

                // destroy entry w/this entid
                DB::table('entries')->where('entid','=',$entid)->delete();

            });
        }
        catch(Exception $e)
        {
            return false;
        }
        return true;
    }

}
