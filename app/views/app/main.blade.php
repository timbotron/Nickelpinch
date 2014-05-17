@extends('home.base')

@section('content')
<div class="container">
	<div class="row">
		<div class="col-xs-10 col-xs-offset-1 col-sm-5 col-sm-offset-1 col-md-3 col-md-offset-2">
			<div class="panel panel-default">
				<div class="panel-heading">
					<h3 class="panel-title">Overview</h3>
            	</div>
            	<table class="table table-condensed">
	              	<tbody>
	              		@foreach($user_data->user_categories as $cat)
	              		@if(in_array($cat->class,[20,30]))
	              		<tr {{ $cat->class==30 ? 'class="success"' : '' }}>
		                	<td>
		                		<a href="#">{{ $cat->category_name }}</a><br>
		                		<span class="{{ $cat->color }}">{{ $currency.number_format($cat->balance,2,'.','') }} / {{ $currency.number_format($cat->top_limit,2,'.','') }}</span>
		                		@if($cat->saved > 0)
		                		<span class="label label-default"><span class="glyphicon glyphicon-lock"></span> {{ $currency.number_format($cat->saved,2,'.','') }}</span>
		                		@endif
		                	</td>
		                	<td>
		                		<span class="pull-right"><a class="btn btn-primary"><span class="glyphicon glyphicon-{{ $cat->class==30 ? 'leaf' : 'plus' }}"></span></a></span>
		                	</td>
		                </tr>
	              		@endif
	              		@endforeach
		                
	               
	              	</tbody>
            	</table>
          	</div>
        </div>

    </div>
</div>

@stop