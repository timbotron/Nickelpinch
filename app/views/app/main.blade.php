@extends('home.base')

@section('content')
<div class="container">
	<div class="row">
		<div class="col-xs-10  col-sm-5 col-sm-offset-1 col-md-3 col-md-offset-2">
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
		                		<a href="/add/{{ $cat->ucid }}">{{ $cat->category_name }}</a><br>
		                		<span class="{{ $cat->color }}">{{ $currency.number_format($cat->balance,2,'.','') }} / {{ $currency.number_format($cat->top_limit,2,'.','') }}</span>
		                		@if($cat->saved > 0)
		                		<span class="label label-default"><span class="glyphicon glyphicon-lock"></span> {{ $currency.number_format($cat->saved,2,'.','') }}</span>
		                		@endif
		                	</td>
		                	<td class="vert-align">
		                		<span class="pull-right"><a href="/add/{{ $cat->ucid }}" class="btn btn-primary"><span class="glyphicon glyphicon-{{ $cat->class==30 ? 'leaf' : 'plus' }}"></span></a></span>
		                	</td>
		                </tr>
	              		@endif
	              		@endforeach
		                
	               
	              	</tbody>
            	</table>
          	</div>
        </div>
        <div class="col-xs-10 col-sm-5 col-md-3">
       		<div class="panel panel-default">
            	<div class="panel-heading">
              		<h3 class="panel-title">{{ $bank_info['name'] }} Summary</h3>
            	</div>
        		<table class="table table-condensed">
  					<tbody>
    					<tr>
					      	<th>Balance:</th>
					      	<td><span class="pull-right">{{ $currency.number_format($bank_info['balance'],2,'.','') }}</span></td>
					    </tr>
    
				    	<tr>
				      		<th>Remaining Budget:</th>
				      		<td><span class="pull-right">-{{ $currency.number_format($bank_info['remaining_budget'],2,'.','') }}</span></td>
				    	</tr>
				    	<tr>
				      		<th>Saved:</th>
				      		<td><span class="pull-right">-{{ $currency.number_format($bank_info['in_saved'],2,'.','') }}</span></td>
				    	</tr>
				    	<tr class="{{ $bank_info['remaining'] > 0 ? 'success' : 'warning' }}">
				      		<th>Extra:</th>
				      		<td><span class="pull-right">{{ $currency.number_format($bank_info['remaining'],2,'.','') }}</span></td>
				    	</tr>
				  	</tbody>
				</table>
			</div>
			<div class="panel panel-default">
	            <div class="panel-heading">
	            	<h3 class="panel-title">Credit Cards</h3>
	            </div>
	            <table class="table table-condensed">
	              	<tbody>
	              		@foreach($user_data->user_categories as $cat)
		              		@if(in_array($cat->class,[10]))
		              		<tr>
			               	<td>
			               		<a href="#">{{ $cat->category_name }} {{ $cat->due_date!='' ? '(Due On '.$cat->due_date.'th)' : ''}}</a><br>
			               		<h4><span class="label label-info">{{ $currency.number_format($cat->balance,2,'.','') }} / {{ $currency.number_format($cat->top_limit,2,'.','') }}</span></h4>
			               		
			               	</td>
			               	<td class="vert-align">
			               		<span class="pull-right"><a class="btn btn-primary"><span class="glyphicon glyphicon-calendar"></span></a></span>
			               	</td>
			               </tr>
		              		@endif
		              	@endforeach
	                	
	                </tbody>
	            </table>
	        </div>
			<div class="panel panel-default">
	            <div class="panel-heading">
	            	<h3 class="panel-title">External Accounts</h3>
	            </div>
	            <table class="table table-condensed">
	              	<tbody>
	              		@foreach($user_data->user_categories as $cat)
		              		@if(in_array($cat->class,[40]))
		              		<tr class="success">
			               	<td>
			               		<a href="#">{{ $cat->category_name }}</a><br>
			               		<span class="{{ $cat->color }}">{{ $currency.number_format($cat->balance,2,'.','') }} / {{ $currency.number_format($cat->top_limit,2,'.','') }}</span>
			               		@if($cat->saved > 0)
			               		<span class="label label-default"><span class="glyphicon glyphicon-lock"></span> {{ $currency.number_format($cat->saved,2,'.','') }}</span>
			               		@endif
			               	</td>
			               	<td class="vert-align">
			               		<span class="pull-right"><a class="btn btn-primary"><span class="glyphicon glyphicon-leaf"></span></a></span>
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