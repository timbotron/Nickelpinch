$(document).ready(function()
{

	// Delete entry modal
	$('table').on('click','.ent-delete',function() 
	{
		var $target = $(this).data('entid');
		var $sure = $('#entry-template-delete').html();
		$sure = $sure.replace(/{entid}/gim,$target);
		$('.details-for-'+$target).after($sure);

	});

	// cancel delete
	$('table').on('click','.delete-entry-abort',function() 
	{
		var $target = $(this).data('entid');
		$('.alert-for-delete-'+$target).remove();

	});

	// Actually delete the entry now!
	$('table').on('click','.delete-entry-confirmed',function() 
	{
		var $target = $(this).data('entid');
		var $deleting = '<div class="alert alert-danger" role="alert"><span class="glyphicon glyphicon-trash"></span>Deleting Entry..</div>';
		var $ok = '<div class="alert alert-success" role="alert"><span class="glyphicon glyphicon-ok"></span> Entry Deleted Successfully</div>';
        $('.alert-for-delete-'+$target).html($deleting);
		
		// Tell that API to delete it!
		$.ajax({
            type: 'DELETE',
            url: '/api/entry_delete/'+$target,  
            data: '',
            dataType: 'html',
            success: function(response) {

               $('.alert-for-delete-'+$target).html($ok);
               setTimeout(function()
               {
               	$('.alert-for-delete-'+$target).parent().fadeOut().parent().fadeOut().prev().fadeOut().prev().fadeOut();
               },500);



                
            },
          
            timeout: function(response) {
                // console.log(response);
            },
            error: function(response,two,three) {
                 var $result = jQuery.parseJSON(response.responseText);
                 var $errors = $result.errors;
                 var $displayme = '';
                 for (var key in $errors)
                 {
                 	if($errors[key] instanceof Array)
                 	{
                 		console.log($errors[key][0]);
                     	$displayme = $displayme + '<div class="alert alert-warning">'+$errors[key][0]+'</div>';
                 		
                 	}
                 	else
                 	{
                 		console.log($errors[key]);
                     	$displayme = $displayme + '<div class="alert alert-warning">'+$errors[key]+'</div>';
                 	}
                     
                 }
                 //// // console.log($displayme);
                 $('.alert-for-delete-'+$target).html($displayme);
            }
        });

	});



	// Display entry details

	$('.get-ent-details').click(function()
	{
		var $target = $(this).attr('data-entid');
		var $button_location = $(this);
		if($button_location.attr('data-expanded')==1)
		{
			$button_location.closest('tr').next().remove();
			$button_location.attr('data-expanded',0);
			$button_location.children().first().removeClass('glyphicon-chevron-up').addClass('glyphicon-chevron-down');
			return false;
		}

		// build new tr with info loading display
		var $loading = $('#entry-template-loading').html();
		$loading = $loading.replace(/{entid}/gim,$target);
		$button_location.closest('tr').after($loading);
		var $main_template = $('#entry-template-main').html();
		
		// now we need the data

		$.ajax({
            type: 'GET',
            url: '/api/entry_detail/'+$target,
            data: '',
            dataType: 'html',
            success: function(response) {

                
                 var $data = jQuery.parseJSON(response);
            	console.log($data[0]);
                $('.entry-'+$target).remove();
                $button_location.attr('data-expanded',1);
                $button_location.children().first().addClass('glyphicon-chevron-up').removeClass('glyphicon-chevron-down');
                // we need to read template and sub vals
                //$main_template = $main_template.replace("{entid}",$data[0].entid);
                $main_template = $main_template.replace(/{entid}/gim, $data[0].entid);
                $main_template = $main_template.replace(/{purchase_date}/gim,$data[0].purchase_date);
                $main_template = $main_template.replace(/{type}/gim,$data[0].type);
                $main_template = $main_template.replace(/{description}/gim,$data[0].description);
                $main_template = $main_template.replace(/{total_amount}/gim,$data[0].total_amount);
                $main_template = $main_template.replace(/{paid_to}/gim,$data[0].paid_to);
                $button_location.closest('tr').after($main_template);
                for(var $i=0; $i < $data[0].section.length; $i++)
                {
                	var $from_template = $('#entry-template-from').html();
                	var $paid_from = '';
                	$from_template = $from_template.replace(/{amount}/gim,$data[0].section[$i].amount);
                	$from_template = $from_template.replace(/{ucid}/gim,$data[0].section[$i].ucid);
                	if($data[0].section[$i].paid_from > 1)
                	{
                		$paid_from = '(Savings)';
                	}
                	$from_template = $from_template.replace(/{paid_from}/gim,$paid_from);
                	$('.entid-'+$target).after($from_template);
                }
                //$button_location.closest('tr').prev().remove();
                //$button_location.closest('tr').remove();


                
            },
          
            timeout: function(response) {
                // console.log(response);
            },
            error: function(response,two,three) {
                 var $result = jQuery.parseJSON(response.responseText);
                 var $errors = $result.errors;
                 var $displayme = '';
                 for (var key in $errors)
                 {
                 	if($errors[key] instanceof Array)
                 	{
                 		console.log($errors[key][0]);
                     	$displayme = $displayme + '<div class="alert alert-warning">'+$errors[key][0]+'</div>';
                 		
                 	}
                 	else
                 	{
                 		console.log($errors[key]);
                     	$displayme = $displayme + '<div class="alert alert-warning">'+$errors[key]+'</div>';
                 	}
                     
                 }
                 //// // console.log($displayme);
                 $('.entry-'+$target).html($displayme);
            }
        });
        return false;


	});

	// Redirect-me
	$('.redirect-me').submit(function()
	{
		// Do redirect
		var $cat = $('#cat_1 option:selected').first().val();
		var $range = $('#date_range option:selected').first().val();
		console.log('/history/' + $cat + '/' + $range);
		window.location = '/history/' + $cat + '/' + $range;
		return false;
	});


	// Ajax-me

	$('.ajax-me').submit(function()
    {
        var $saving = '<div class="alert alert-info" role="alert"><span class="glyphicon glyphicon-cloud-upload"></span> Processing..</div>';
        var $ok = '<div class="alert alert-success" role="alert"><span class="glyphicon glyphicon-ok"></span> Process Successful.</div>';
        $('.btns-to-toggle').hide();
        // // console.log('submitted form');
        var $identifier = $(this).attr('data-id');
        var $target = $(this).attr('data-target');
        var $params = $(this).serialize();

        $('.'+$identifier+'-status').html($saving);
        
         
        $.ajax({
                type: 'POST',
                url: $(this).attr('action'),
                data: $params,
                dataType: 'json',
                success: function(response) {
                    
                     console.log('success! ');
                     console.log(response);
                    $('.'+$identifier+'-status').html($ok);
                    window.location=$target;
                    
                },
              
                timeout: function(response) {
                    // console.log(response);
                },
                error: function(response,two,three) {
                     var $result = jQuery.parseJSON(response.responseText);
                     var $errors = $result.errors;
                     var $displayme = '';
                     for (var key in $errors)
                     {
                     	if($errors[key] instanceof Array)
                     	{
                     		console.log($errors[key][0]);
                         	$displayme = $displayme + '<div class="alert alert-warning">'+$errors[key][0]+'</div>';
                     		
                     	}
                     	else
                     	{
                     		console.log($errors[key]);
                         	$displayme = $displayme + '<div class="alert alert-warning">'+$errors[key]+'</div>';
                     	}
                         
                     }
                     //// // console.log($displayme);
                     $('.'+$identifier+'-messages').html($displayme);
                     scroll(0,0);
                     $('.btns-to-toggle').show();
                     $('.'+$identifier+'-status').html('');
                }
            });
            return false;
    });

	// Entry Add

	if($('.entry-add').length)
	{
		$('.using-manual-date').click(function()
		{
			if(this.checked)
			{
				$('.date-dd').hide();
				$('.date-txt').show();
			}
			else
			{
				$('.date-dd').show();
				$('.date-txt').hide();
			}

		});
		$('.using-multi-cats').click(function()
		{
			if(this.checked)
			{
				$('.multi-cats').show();
			}
			else
			{
				$('.multi-cats').hide();
			}

		});
	}

	//Budget

	$('.filter-budget input').click(function()
	{
		$('tr').hide();

		$('.filter-budget input:checked').each(function()
		{
			$('tr.'+$(this).val()).show();
		});
	});

	if($('.budget-edit-view').length)
	{
		// hit appropriate class button for good labels/text
		
	}

	$('.budget-add-buttons button').click(function()
	{
		if($('.budget-view').length)
		{
			if($(this).hasClass('cc-btn'))
			{
				// update form
				$('form legend').html('Add a Credit Card');
				$('form label[for="category_name"]').html('Credit Card Name');
				$('form label[for="top_limit"]').html('Credit Card Limit');
				$('form input[name="category_name"]').attr('placeholder','Enter Credit Card Name');
				$('.if-cc').show();
				$('form input[type="submit"]').val('Create Credit Card');
				$('form input[name="class"]').val('credit_card');
			}
			else if($(this).hasClass('cat-btn'))
			{
				// update form
				$('form legend').html('Add a Category');
				$('form label[for="category_name"]').html('Category Name');
				$('form label[for="top_limit"]').html('Monthly Spending Limit');
				$('form input[name="category_name"]').attr('placeholder','Enter Category Name');
				$('form input[name="class"]').val('standard');
				$('.if-cc').hide();
				$('form input[type="submit"]').val('Create Category');
			}
			else if($(this).hasClass('sav-btn'))
			{
				// update form
				$('form legend').html('Add a Savings Category');
				$('form label[for="category_name"]').html('Savings Category Name');
				$('form label[for="top_limit"]').html('Monthly Savings Goal');
				$('form input[name="category_name"]').attr('placeholder','Enter Savings Category Name');
				$('form input[name="class"]').val('savings');
				$('.if-cc').hide();
				$('form input[type="submit"]').val('Create Savings Category');
			}
			else if($(this).hasClass('exsav-btn'))
			{
				// update form
				$('form legend').html('Add an External Savings Category');
				$('form label[for="category_name"]').html('Savings Category Name');
				$('form label[for="top_limit"]').html('Monthly Savings Goal');
				$('form input[name="category_name"]').attr('placeholder','Enter Savings Category Name');
				$('form input[name="class"]').val('ext_savings');
				$('.if-cc').hide();
				$('form input[type="submit"]').val('Create External Savings Category');
			}
		}
		else if($('.budget-edit-view').length)
		{
			if($(this).hasClass('cc-btn'))
			{
				// update form
				$('form legend').html('Update Credit Card');
				$('form label[for="category_name"]').html('Credit Card Name');
				$('form label[for="top_limit"]').html('Credit Card Limit');
				$('form input[name="category_name"]').attr('placeholder','Enter Credit Card Name');
				$('.if-cc').show();
				$('form input[type="submit"]').val('Update Credit Card');
				$('form input[name="class"]').val('credit_card');
			}
			else if($(this).hasClass('cat-btn'))
			{
				// update form
				$('form legend').html('Update Category');
				$('form label[for="category_name"]').html('Category Name');
				$('form label[for="top_limit"]').html('Monthly Spending Limit');
				$('form input[name="category_name"]').attr('placeholder','Enter Category Name');
				$('form input[name="class"]').val('standard');
				$('.if-cc').hide();
				$('form input[type="submit"]').val('Update Category');
			}
			else if($(this).hasClass('sav-btn'))
			{
				// update form
				$('form legend').html('Update Savings Category');
				$('form label[for="category_name"]').html('Savings Category Name');
				$('form label[for="top_limit"]').html('Monthly Savings Goal');
				$('form input[name="category_name"]').attr('placeholder','Enter Savings Category Name');
				$('form input[name="class"]').val('savings');
				$('.if-cc').hide();
				$('form input[type="submit"]').val('Update Savings Category');
			}
			else if($(this).hasClass('exsav-btn'))
			{
				// update form
				$('form legend').html('Update External Savings Category');
				$('form label[for="category_name"]').html('Savings Category Name');
				$('form label[for="top_limit"]').html('Monthly Savings Goal');
				$('form input[name="category_name"]').attr('placeholder','Enter Savings Category Name');
				$('form input[name="class"]').val('savings');
				$('.if-cc').hide();
				$('form input[type="submit"]').val('Update External Savings Category');
			}
		}
		
		$('.budget-add-buttons button').attr('disabled',false).removeClass('btn-primary').addClass('btn-default');
		$(this).attr('disabled',true).addClass('btn-primary').removeClass('btn-default');

	});
});