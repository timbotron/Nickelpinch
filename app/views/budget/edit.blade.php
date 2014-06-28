@extends('home.base')

@section('content')
<div class="container budget-edit-view">

	@include('budget.category_edit')

<div class="row">
	<div class="col-sm-8 col-sm-offset-2 col-md-6 col-md-offset-3">
		<div class="alert alert-info"><strong>Archiving</strong><br />Use this to archive or unarchive a category. It's important that we never actually delete a category, so we can always view reports.</div>
	</div>
</div>
<div class="row">
	<div class="col-sm-8 col-sm-offset-2 col-md-6 col-md-offset-3">
		{{ Form::open($form_data) }}
			<fieldset>
			<legend>{{ $uc->class==255 ? 'Unarchive' : 'Archive'}} Category</legend>
			@foreach($errors->all() as $message)
			        <div class="alert alert-warning">{{ $message }}</div>
			@endforeach
				@if($uc->class==255)
				<div class="form-group">
					{{ Form::label('class', 'Restoring Category to'); }}
					{{ Form::select('class',$nikl_config['uc_class_def'],null,array('class'=>'form-control')) }}
				</div>
				@else
				{{ Form::hidden('class',255) }}
				@endif

				{{ Form::hidden('top_limit',$uc->top_limit) }}
				{{ Form::hidden('category_name',$uc->category_name) }}
				{{ Form::hidden('rank',1000) }}
				{{ Form::hidden('is_archive_feature',1) }}


				

			   

			    {{-- Form submit button. --------------------}}
			    @if($uc->class==255)
			    {{ Form::submit('Unarchive Category',['class'=>'btn btn-primary']) }}
			    @else
			    {{ Form::submit('Archive Category',['class'=>'btn btn-primary']) }}
			    @endif
			    <a href="/budget" class="btn btn-default">Cancel</a>

			</fieldset>

			{{ Form::close() }}
	</div>
</div>

</div>

@stop