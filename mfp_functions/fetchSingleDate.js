'use strict';

var request = require('request');
var cheerio = require('cheerio');
var helpers = require('./helper-utils');

//TODO: add the option to lock with a key.

//some notes: we use the printable diary for most checks, but not water, which can't be fetched here.
var fetchSingleDate = function(username, date, fields, callback){
  //get MyFitnessPal URL (eg. 'https://www.myfitnesspal.com/reports/printable_diary/npmmfp?from=2014-09-13&to=2014-09-13')
  var url = helpers.mfpUrl(username, date, date);
  console.log(url);
  var options = {
    url: url,
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 6.1) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/41.0.2228.0 Safari/537.36'
    }
  };

  request(options, function(error, response, body) {
    if (error) throw error;

    var $ = cheerio.load(body);

    //set results object to store data
    var results = {};

    //define variable for determining columns of fields on MFP page
    var colsDiary = {};
    var colsExercise = {};

    // find and set column numbers of nutrient fields
    $('#food').find('thead').find('tr').find('td').each(function(index, element){
      var $element = $(element);
      var fieldName = $element.text().toLowerCase();
      if (fieldName === "sugars") { fieldName = "sugar"; } // fixes MFP nutrient field name inconsistency
      if (fieldName === "cholest") { fieldName = "cholesterol"; } // fixes MFP nutrient field name inconsistency
      if (index !== 0) { colsDiary[fieldName] = index; } //ignore first field, which just says "Foods"
    });

    //find row in MFP with nutrient totals
    var $dataRow = $('tfoot').find('tr');

    //store data for each field in results
    for (var fieldDiary in colsDiary) {
      var colDiary = colsDiary[fieldDiary] + 1; //because nth-child selector is 1-indexed, not 0-indexed
      var mfpDataDiary = $dataRow.first().find('td:nth-child(' + colDiary + ')').first().text();
      results[fieldDiary] = helpers.convertToNum(mfpDataDiary);
    }

    //TODO: Use only Samsung calorie adjustment!!!
    //find and set column numbers of exercise fields
    $('#excercise').find('thead').find('tr').find('td').each(function(index, element){
      var $element = $(element);
      var fieldName = $element.text().toLowerCase();
      if (fieldName === "calories") { fieldName = "burnedCalories"; } // fixes MFP nutrient field name inconsistency
      if (index !== 0) { colsExercise[fieldName] = index; } //ignore first field, which just says "Exercise"
    });

    //store data for each field in results
    for (var fieldExercise in colsExercise) {
      var colExercise = colsExercise[fieldExercise] + 1; //because nth-child selector is 1-indexed, not 0-indexed
      var mfpDataExercise = $dataRow.last().find('td:nth-child(' + colExercise + ')').first().text();
      results[fieldExercise] = helpers.convertToNum(mfpDataExercise);
    }

    if (fields !== 'all' && Array.isArray(fields)) {
      //create targetFields object to hash user-specified nutrient fields
      var targetFields = {};
      fields.forEach(function(field){
        targetFields[field] = true;
      });

      for (var nutrient in results) {
        if (targetFields[nutrient] === undefined) {
          delete results[nutrient];
        }
      }
    }
    
    //add date to results object
    results.date = date;
    
    //check to see if water is included
    if (fields == 'all' || fields.includes('water')) {
      var url = helpers.mfpWaterUrl(username, date);

      var options = {
        url: url,
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 6.1) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/41.0.2228.0 Safari/537.36'
        }
      };

      request(options, function(error, response, body) {
        if (error) throw error;

        var $ = cheerio.load(body);
        if($('#water_cups').find('p').length !== 0) {
          results['water'] = helpers.convertToNum($('#water_cups').find('p').text());
        }
        callback(results);
      });
    } else {
      callback(results);
    }
  });
};

module.exports = fetchSingleDate;
