#!/usr/bin/env node
// Yellowpages Web Scraper
// Systematically extracts business listings from Yellowpages and other sources
// Identifies companies with websites that need improvement

import axios from 'axios';
import { load } from 'cheerio';
import { URL } from 'url';

class YellowpagesScraper {
  constructor(options = {}) {
    this.baseUrl = 'https://www.yellowpages.com';
    this.searchUrl = `${this.baseUrl}/search`;
    this.requestDelay = options.requestDelay || 1000; // 1 second between requests
    this.maxPages = options.maxPages || 5;
    this.timeout = options.timeout || 30000;
    this.userAgent = options.userAgent || 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36';
  }

  async searchBusinesses(query, location, options = {}) {
    const results = [];
    const searchTerm = `${query} ${location}`.trim();
    
    try {
      // Search for businesses
      const businesses = await this.scrapeSearchPage(searchTerm, options);
      
      // For each business found, extract detailed information
      for (const business of businesses) {
        const detailed = await this.extractBusinessDetails(business.url);
        if (detailed) {
          results.push(detailed);
        }
        
        // Rate limiting
        await this.sleep(this.requestDelay);
      }
      
      return results;
    } catch (error) {
      console.error('❌ Yellowpages scrape failed:', error.message);
      return [];
    }
  }

  async scrapeSearchPage(searchTerm, options = {}) {
    const businesses = [];
    const page = options.page || 1;
    
    const params = new URLSearchParams({
      search_terms: searchTerm,
      page: page.toString(),
      ...(options.city && { city: options.city }),
      ...(options.state && { state: options.state })
    });
    
    try {
      const response = await axios.get(`${this.searchUrl}?${params.toString()}`, {
        headers: {
          'User-Agent': this.userAgent,
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
          'Accept-Language': 'en-US,en;q=0.5',
          'Accept-Encoding': 'gzip, deflate, br',
          'DNT': '1',
          'Connection': 'keep-alive',
          'Upgrade-Insecure-Requests': '1'
        },
        timeout: this.timeout
      });
      
      const $ = load(response.data);
      
      // Extract business listings from search results
      $('.search-result business-listing, .search-result .business-name').each((index, element) => {
        const business = {};
        
        // Get business name
        business.name = $(element).find('.business-name, .listing-title').first().text().trim();
        
        // Get business URL
        business.url = $(element).find('a').first().attr('href');
        if (business.url && !business.url.startsWith('http')) {
          business.url = `${this.baseUrl}${business.url}`;
        }
        
        // Get basic info from search snippet
        business.address = $(element).find('.address, .street-address').first().text().trim();
        business.phone = $(element).find('.phone, .phone-number').first().text().trim();
        
        // Get rating if available
        business.rating = $(element).find('.rating, .stars').first().attr('content') || null;
        
        if (business.name && business.url) {
          businesses.push(business);
        }
      });
      
      return businesses;
    } catch (error) {
      console.error('❌ Failed to scrape Yellowpages search page:', error.message);
      return [];
    }
  }

  async extractBusinessDetails(businessUrl) {
    try {
      const response = await axios.get(businessUrl, {
        headers: {
          'User-Agent': this.userAgent,
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
          'Accept-Language': 'en-US,en;q=0.5'
        },
        timeout: this.timeout
      });
      
      const $ = load(response.data);
      const business = {};
      
      // Extract business name from page title
      business.name = $('title').text().split(' | ')[0] || $('h1').first().text().trim();
      
      // Extract website URL if available
      business.website = this.extractWebsiteUrl($);
      
      // Extract phone number
      business.phone = this.extractPhoneNumber($);
      
      // Extract address
      business.address = this.extractAddress($);
      
      // Extract business category/type
      business.businessType = this.extractBusinessType($);
      
      // Extract social media presence
      business.socialMedia = this.extractSocialMedia($);
      
      // Extract current website tech stack indicators
      if (business.website) {
        business.currentTech = await this.analyzeWebsiteTech(business.website);
      }
      
      business.url = businessUrl;
      business.lastUpdated = new Date().toISOString();
      
      return business;
    } catch (error) {
      console.error(`❌ Failed to extract details from ${businessUrl}:`, error.message);
      return null;
    }
  }

  extractWebsiteUrl($) {
    // Look for "Visit website" links or social media profiles
    const websiteSelectors = [
      'a[rel="nofollow"][href*="http"]',
      'a[href*="http"]',
      'meta[property="og:url"]',
      'a:contains("website")',
      'a:contains("visit")'
    ];
    
    for (const selector of websiteSelectors) {
      const element = $(selector).first();
      if (element.length) {
        if (element.is('meta')) {
          return element.attr('content');
        } else {
          return element.attr('href');
        }
      }
    }
    
    // Look for external links in the content
    const externalLinks = $('a[href^="http"]:not([href*="yellowpages.com"])').filter((index, element) => {
      const href = $(element).attr('href');
      const text = $(element).text().toLowerCase();
      return text.includes('website') || text.includes('visit') || 
             !text.includes('directions') && !text.includes('contact') && 
             !text.includes('phone') && !text.includes('email');
    });
    
    return externalLinks.first().attr('href') || null;
  }

  extractPhoneNumber($) {
    // Look for phone number in various formats
    const phoneSelectors = [
      'a[href^="tel:"]',
      '[data-phone]',
      '.phone-number',
      '.contact-phone',
      'span:contains("Phone:")',
      'div:contains("Phone:")'
    ];
    
    for (const selector of phoneSelectors) {
      const element = $(selector).first();
      if (element.length) {
        if (element.is('a')) {
          return element.attr('href').replace('tel:', '');
        } else {
          const text = element.text().trim();
          const match = text.match(/\d{3}[-.\s]?\d{3}[-.\s]?\d{4}/);
          return match ? match[0] : null;
        }
      }
    }
    
    return null;
  }

  extractAddress($) {
    // Look for address information
    const addressSelectors = [
      '.address',
      '.street-address',
      '.business-address',
      '[data-address]',
      '.location'
    ];
    
    for (const selector of addressSelectors) {
      const element = $(selector).first();
      if (element.length) {
        return element.text().trim();
      }
    }
    
    return null;
  }

  extractBusinessType($) {
    // Extract business category/type
    const typeSelectors = [
      '.category',
      '.business-category',
      'meta[property="business:category"]',
      '.business-type',
      'span:contains("Industry")',
      'div:contains("Type:")'
    ];
    
    for (const selector of typeSelectors) {
      const element = $(selector).first();
      if (element.length) {
        if (element.is('meta')) {
          return element.attr('content');
        } else {
          return element.text().trim();
        }
      }
    }
    
    return null;
  }

  extractSocialMedia($) {
    const socialMedia = {};
    
    const socialSelectors = {
      facebook: 'a[href*="facebook.com"]',
      instagram: 'a[href*="instagram.com"]',
      linkedin: 'a[href*="linkedin.com"]',
      twitter: 'a[href*="twitter.com"]',
      google: 'a[href*="google.com"]'
    };
    
    for (const [platform, selector] of Object.entries(socialSelectors)) {
      const element = $(selector).first();
      if (element.length) {
        socialMedia[platform] = element.attr('href');
      }
    }
    
    return Object.keys(socialMedia).length > 0 ? socialMedia : null;
  }

  async analyzeWebsiteTech(websiteUrl) {
    try {
      const response = await axios.get(websiteUrl, {
        headers: {
          'User-Agent': this.userAgent
        },
        timeout: 15000
      });
      
      const $ = load(response.data);
      const tech = {};
      
      // Check for tech stack indicators
      const html = response.data.toLowerCase();
      
      // CMS detection
      if (html.includes('wordpress')) tech.cms = 'WordPress';
      else if (html.includes('joomla')) tech.cms = 'Joomla';
      else if (html.includes('drupal')) tech.cms = 'Drupal';
      else if (html.includes('shopify')) tech.cms = 'Shopify';
      else tech.cms = 'Unknown';
      
      // Framework detection
      if (html.includes('bootstrap')) tech.framework = 'Bootstrap';
      else if (html.includes('jquery')) tech.framework = 'jQuery';
      else if (html.includes('react')) tech.framework = 'React';
      else if (html.includes('vue')) tech.framework = 'Vue';
      else tech.framework = 'Vanilla HTML/CSS';
      
      // SSL check
      tech.https = websiteUrl.startsWith('https://');
      
      // Mobile responsiveness
      tech.mobile = $('meta[name="viewport"]').length > 0;
      
      // Performance indicators
      const scripts = $('script[src]').length;
      const styles = $('link[rel="stylesheet"]').length;
      tech.complexity = scripts + styles;
      
      // Content quality
      const textLength = $.text().trim().length;
      tech.contentLength = textLength;
      tech.hasBlog = $('article, .post, .blog').length > 0;
      tech.hasContactForm = $('form, input[type="email"]').length > 0;
      
      return tech;
    } catch (error) {
      console.warn(`⚠️ Could not analyze website ${websiteUrl}:`, error.message);
      return null;
    }
  }

  async sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  generateBusinessSummary(business) {
    return {
      name: business.name,
      source: 'yellowpages_scraper',
      website: business.website,
      phone: business.phone,
      address: business.address,
      businessType: business.businessType,
      socialMedia: business.socialMedia,
      currentTech: business.currentTech,
      url: business.url,
      lastUpdated: business.lastUpdated,
      discoveryDate: new Date().toISOString(),
      scrapeConfidence: business.website ? 'high' : 'low',
      priority: this.calculateBusinessPriority(business)
    };
  }

  calculateBusinessPriority(business) {
    let priority = 'low';
    
    // High priority: has website but outdated tech
    if (business.website && business.currentTech) {
      if (!business.currentTech.https || business.currentTech.cms === 'Unknown' || 
          business.currentTech.complexity > 10) {
        priority = 'high';
      }
    }
    
    // Medium priority: no website or very basic presence
    else if (!business.website || !business.currentTech) {
      priority = 'medium';
    }
    
    return priority;
  }

  async searchYellowpages(query, location, options = {}) {
    // Main entry point for Yellowpages scraping
    const allBusinesses = [];
    
    try {
      console.log(`🔍 Searching Yellowpages for "${query}" in "${location}"...
      
      // Search multiple pages
      for (let page = 1; page <= this.maxPages && page <= this.maxPages; page++) {
        console.log(`📄 Scraping page ${page}...
        
        const businesses = await this.scrapeSearchPage(`${query} ${location}`, { page, ...options });
        allBusinesses.push(...businesses);
        
        // If no businesses found on this page, stop
        if (businesses.length === 0) break;
      }
      
      console.log(`✅ Found ${allBusinesses.length} potential business listings from Yellowpages.
      
      // Extract detailed information for each business
      const detailedBusinesses = [];
      for (let i = 0; i < allBusinesses.length; i++) {
        const business = allBusinesses[i];
        console.log(`📊 Extracting details (${i + 1}/${allBusinesses.length})...`);
        
        const detailed = await this.extractBusinessDetails(business.url);
        if (detailed) {
          detailedBusinesses.push(detailed);
        }
        
        // Rate limiting between requests
        await this.sleep(this.requestDelay);
      }
      
      console.log(`✅ Extracted ${detailedBusinesses.length} detailed business records.
      
      return detailedBusinesses.map(business => this.generateBusinessSummary(business));
    } catch (error) {
      console.error('❌ Yellowpages search failed:', error.message);
      return [];
    }
  }
}

export default YellowpagesScraper;
export { YellowpagesScraper };