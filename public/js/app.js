$(document).ready(function()
{

	// Display entry details

	$('.get-ent-details').click(function()
	{
		var $target = $(this).attr('data-entid');

		// build new tr with info loading display
		var $loading = '<div class="entry-'+$target+'"><tr><td colspan="4"><div class="alert alert-info" role="alert"><strong>Loading..</strong></div></td></tr></div>';
		$(this).closest('tr').after($loading);
		var $main_template = $('#entry-template-main').html();
		var $from_template = $('#entry-template-from').html();
		console.log($temp1);
		// now we need the data

		$.ajax({
            type: 'POST',
            url: '/entry/detail/'+$target,
            data: '',
            dataType: 'html',
            success: function(response) {
                
                 console.log('success! ');
                 console.log(response);
                $('.entry-'+$target).html('data');
                
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
        console.log('submitted! ');
        var $saving = '<div class="alert alert-info" role="alert"><span class="glyphicon glyphicon-cloud-upload"></span> Saving Entry..</div>';
        var $ok = '<div class="alert alert-success" role="alert"><span class="glyphicon glyphicon-ok"></span> Entry Saved Successfully</div>';
        $('.btns-to-toggle').hide();
        // // console.log('submitted form');
        var $identifier = $(this).attr('data-id');
        var $target = $(this).attr('data-target');
        var $params = $(this).serialize();

        $('.'+$identifier+'-status').html($saving);
        // // console.log($params);

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