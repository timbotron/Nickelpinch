@extends('home.base')

@section('content')
<div class="container">
	<div class="row entry-add">
		<div class="col-sm-8 col-sm-offset-2 col-md-6 col-md-offset-3">
			{{ Form::open($form_data) }}
			<fieldset>
			<legend>Add an Entry</legend>
			
			<div class="entry-messages"></div>

			<div class="form-group">
				{{ Form::label('amount', 'Amount') }}
				<div class="input-group">
  					<span class="input-group-addon">{{ $currency }}</span> 
					{{ Form::input('number','amount',null,array('class'=>'form-control','step'=>'any','min'=>'0')) }}
				</div>
			</div>
			<div class="form-group">
				{{ Form::label('description', 'Description') }}
				{{ Form::text('description',null,array('class'=>'form-control','placeholder'=>'Optional Description')) }}	
			</div>
			<div class="form-group">
				{{ Form::label('paid_to', 'Paid Via') }}
				{{ Form::select('paid_to',$paid_with,$user_data->default_pmt_method,array('class'=>'form-control')) }}
			</div>
			<div class="form-group date-dd">
				{{ Form::label('date_1', 'Date') }}
				{{ Form::select('date_1',$dates,date('Y-m-d'),array('class'=>'form-control')) }}
			</div>

			<div class="form-group date-txt" style="display:none;">
				{{ Form::label('date_2', 'Date') }}
				{{ Form::text('date_2',date('Y-m-d'),array('class'=>'form-control','placeholder'=>'Optional Description')) }}	
			</div>
			<div class="checkbox">
			    <label>
			    <input name="using_manual_date" value="1" type="checkbox" class="using-manual-date"> Enter date manually
			    </label>
			</div>

			<div class="form-group">
				{{ Form::label('cat_1', 'Category') }}
				<div class="row">
					<div class="col-xs-6">
						{{ Form::select('cat_1',$cats_dd,$target_cat,array('class'=>'form-control')) }}
					</div>
					<div class="col-xs-6 multi-cats" style="display:none;">
						<div class="input-group">
		  					<span class="input-group-addon">{{ $currency }}</span> 
							{{ Form::input('number','cat_1_val',null,array('class'=>'form-control','step'=>'any','min'=>'0')) }}
						</div>
					</div>
					<div class="col-xs-6 multi-cats" style="display:none;">
						{{ Form::select('cat_2',$cats_dd,0,array('class'=>'form-control')) }}
					</div>
					<div class="col-xs-6 multi-cats" style="display:none;">
						<div class="input-group">
		  					<span class="input-group-addon">{{ $currency }}</span> 
							{{ Form::input('number','cat_2_val',null,array('class'=>'form-control','step'=>'any','min'=>'0')) }}
						</div>
					</div>
					<div class="col-xs-6 multi-cats" style="display:none;">
						{{ Form::select('cat_3',$cats_dd,0,array('class'=>'form-control')) }}
					</div>
					<div class="col-xs-6 multi-cats" style="display:none;">
						<div class="input-group">
		  					<span class="input-group-addon">{{ $currency }}</span> 
							{{ Form::input('number','cat_3_val',null,array('class'=>'form-control','step'=>'any','min'=>'0')) }}
						</div>
					</div>
				</div>
				
			</div>
			<div class="checkbox">
			    <label>
			    <input name="using_multi_cats" value="1" type="checkbox" class="using-multi-cats"> Multi-category purchase?
			    </label>
			</div>

			{{-- Form submit button. --------------------}}
			<div class="entry-status"></div>
			<div class="btns-to-toggle">
				{{ Form::submit('Save Entry',['class'=>'btn btn-primary']) }}
				<a class="btn btn-default" href="/home">Cancel</a>
			</div>
			</fieldset>
			{{ Form::close() }}
			

			
		</div>
	</div>
	

</div>

@stop