@extends('home.base')

@section('content')
<div class="container">
	<div class="row entry-add">
		<div class="col-md-10 col-md-offset-1 col-lg-8 col-lg-offset-2">
		{{ Form::open($form_data) }}
			<fieldset>
			<div class="form-group">
				{{ Form::label('cat_1', 'Category: ') }}
				{{ Form::select('cat_1',$cats_dd,$target_cat,array('class'=>'form-control')) }}
			</div>
			<div class="form-group">
				{{ Form::label('date_range', ' Within: ') }}
				{{ Form::select('date_range',$date_range_dd,$target_range,array('class'=>'form-control')) }}
			</div>

			
			<button type="submit" class="btn btn-primary">Filter</button>

			</fieldset>
		{{ Form::close() }}

		<table class="table">
			<thead>
				<tr>
					<th>Amount</th><th>Type</th><th>Date</th><th>To/From</th>
				</tr>
			</thead>
			<tbody>
				@if($history)
				@foreach($history as $h)
				<tr class="active">
					<td>{{ $currency . ($target_cat==$h->paid_to ? $h->total_amount : $h->amount) }}</td>
					<td>{{ $nikl_config['entry_types'][$h->type]}}</td>
					<td>{{ date('M j, Y',strtotime($h->purchase_date)) }}</td>
					<td>{{ ($target_cat==$h->paid_to ? '<span class="glyphicon glyphicon-chevron-right"></span> ' : '<span class="glyphicon glyphicon-chevron-left"></span> '). $target_name }}</td>
				</tr>
				<tr>
					<td colspan="4">{{ $h->description }} <button data-entid="{{ $h->entid }}" data-expanded="0" class="btn btn-info btn-sm pull-right get-ent-details"><span class="glyphicon glyphicon-chevron-down"></span></button></td>
				</tr>
				@endforeach
				@endif
			</tbody>

		</table>

		</div>
	</div>
	

</div>

<script id="entry-template-loading" type="text/html">
	<tr class="entry-{entid}">
		<td colspan="4">
			<div class="alert alert-info" role="alert"><strong>Loading..</strong></div>
		</td>
	</tr>
</script>
<script id="entry-template-main" type="text/html">
	<tr>
		<td colspan="4" class="vert-align ">
			<strong>Entry Detail</strong> <button data-entid="{entid}" class="btn btn-danger btn-sm pull-right ent-delete"><span class="glyphicon glyphicon-trash"></span></button><br /><br />
			<table class="table table-bordered details-for-{entid}">
				<tr><td>{purchase_date}</td><td>{type}</td><td>{description}</td></tr>
				<tr class="active entid-{entid}"><td>{{ $currency }}{total_amount}</td><td colspan="2"><span class="glyphicon glyphicon-chevron-right"></span> {paid_to}</td></tr>
			</table>
		</td>
	</tr>
</script>
<script id="entry-template-from" type="text/html">
	<tr>
		<td>{{ $currency }}{amount}</td>
		<td colspan="2"><span class="glyphicon glyphicon-chevron-left"></span> {ucid} {paid_from}</td>
	</tr>
</script>
<script id="entry-template-delete" type="text/html">
	<div class="alert-for-delete-{entid}">	
		<div class="alert alert-danger" role="alert"><strong>Warning!</strong> Deleting this entry is irreversible; are you sure?</div>
		<button class="btn btn-danger delete-entry-confirmed" data-entid="{entid}">Delete Entry</button> 
		<button class="btn btn-info delete-entry-abort" data-entid="{entid}">Cancel</button> 
	</div>
</script>

@stop