#!/usr/bin/env node
// Enhanced Prospect Finder
// Combines multiple data sources and improvement analysis
// Filters for only businesses with improvement needs

import { spawnSync } from 'node:child_process';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'url';

import YellowpagesScraper from '../yellowpages-scraper/src/yellowpages-scraper.mjs';
import YellowpagesClient from '../yellowpages-client/src/yellowpages-client.mjs';
import TechAversionDetector from '../tech-aversion-detector/src/tech-aversion-detector.mjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const args = process.argv.slice(2);
const niche = args[0];
const location = args[1];

const useYellowpages = args.includes('--yellowpages') || args.includes('--scrape');
const useTechAversion = args.includes('--tech-aversion');
const doAudit = args.includes('--audit');
const minOpportunityScore = args.includes('--min-score') ? 
  parseInt(args[args.indexOf('--min-score') + 1]) || 35 : 35;
const maxResults = args.includes('--max') ? parseInt(args[args.indexOf('--max') + 1]) || 50 : 50;

async function enhancedGooglePlacesSearch(q, limit = maxResults) {
  const KEY = process.env.GOOGLE_PLACES_API_KEY || '';
  if (!KEY) {
    console.error('❌ GOOGLE_PLACES_API_KEY not set (.env)');
    return [];
  }

  const fm = [
    'places.displayName',
    'places.formattedAddress',
    'places.nationalPhoneNumber',
    'places.websiteUri',
    'places.rating',
    'places.userRatingCount',
    'places.primaryType',
    'places.businessStatus'
  ].join(',');

  const res = await fetch('https://places.googleapis.com/v1/places:searchText', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Goog-Api-Key': KEY,
      'X-Goog-FieldMask': fm
    },
    body: JSON.stringify({
      textQuery: q,
      maxResultCount: Math.min(limit, 20)
    }),
    signal: AbortSignal.timeout(20000)
  });

  if (!res.ok) {
    throw new Error('Places ' + res.status);
  }

  return (await res.json()).places || [];
}

function audit(url) {
  const A = resolve(dirname(fileURLToPath(import.meta.url)), '../audit/src/audit.mjs');
  const r = spawnSync('node', [A, url, '--json'], {
    encoding: 'utf8',
    timeout: 90000
  });
  if (r.status !== 0 || !r.stdout) return null;
  try {
    return JSON.parse(r.stdout);
  } catch {
    return null;
  }
}

async function enhancedGooglePlacesWithAudit(q, limit = maxResults) {
  const places = await enhancedGooglePlacesSearch(q, limit);
  const results = [];
  
  for (const place of places) {
    if (!place.businessStatus || place.businessStatus === 'OPERATIONAL') {
      const result = {
        name: place.displayName?.text || '',
        phone: place.nationalPhoneNumber || '',
        address: place.formattedAddress || '',
        website: place.websiteUri || '',
        hasWebsite: !!place.websiteUri,
        rating: place.rating ?? null,
        reviews: place.userRatingCount ?? 0,
        type: place.primaryType || niche,
        source: 'google_places'
      };
      
      if (result.hasWebsite && doAudit) {
        result.audit = audit(result.website);
      }
      
      results.push(result);
      
      await new Promise(resolve => setTimeout(resolve, 500)); // Rate limiting
    }
  }
  
  return results;
}

async function yellowpagesWithDetails(niche, location, limit = maxResults) {
  const scraper = new YellowpagesScraper({ maxPages: 3, requestDelay: 2000 });
  return await scraper.searchYellowpages(niche, location, { limit });
}

async function analyzeWebsiteForImprovements(websiteUrl) {
  if (!websiteUrl) return null;
  
  try {
    const auditResult = audit(websiteUrl);
    if (!auditResult) return null;
    
    const opportunities = [];
    const issues = [];
    
    // Check for technical issues
    if (!auditResult.https) {
      opportunities.push({
        category: 'technical',
        severity: 'high',
        finding: 'No HTTPS encryption',
        impact: 'Browsers show "Not Secure" warning, hurts SEO and trust',
        fix: 'Implement SSL certificate and force HTTPS'
      });
      issues.push('No HTTPS');
    }
    
    if (auditResult.siteWrightScore < 50) {
      opportunities.push({
        category: 'technical',
        severity: auditResult.siteWrightScore < 30 ? 'high' : 'medium',
        finding: `Low site score (${auditResult.siteWrightScore}/100)`,
        impact: 'Poor performance, bad user experience, SEO penalties',
        fix: 'Full site rebuild with modern standards'
      });
      issues.push(`Low site score: ${auditResult.siteWrightScore}/100`);
    }
    
    if (auditResult.mobileIssues && auditResult.mobileIssues.length > 0) {
      opportunities.push({
        category: 'technical',
        severity: 'medium',
        finding: `Mobile issues detected (${auditResult.mobileIssues.length})`,
        impact: 'Over 60% of traffic is mobile, non-mobile sites lose customers',
        fix: 'Mobile-first responsive design'
      });
      issues.push(`Mobile issues: ${auditResult.mobileIssues.length}`);
    }
    
    if (auditResult.securityIssues && auditResult.securityIssues.length > 0) {
      opportunities.push({
        category: 'security',
        severity: 'high',
        finding: `Security vulnerabilities (${auditResult.securityIssues.length})`,
        impact: 'Exposes customers to data theft and attacks',
        fix: 'Security hardening and regular updates'
      });
      issues.push(`Security issues: ${auditResult.securityIssues.length}`);
    }
    
    if (auditResult.performanceIssues && auditResult.performanceIssues.length > 0) {
      opportunities.push({
        category: 'performance',
        severity: 'medium',
        finding: `Performance issues (${auditResult.performanceIssues.length})`,
        impact: 'Slow loading loses customers and hurts SEO',
        fix: 'Optimize images, enable caching, minify resources'
      });
      issues.push(`Performance issues: ${auditResult.performanceIssues.length}`);
    }
    
    // Check for missing functionality
    if (auditResult.missingFeatures && auditResult.missingFeatures.length > 0) {
      for (const feature of auditResult.missingFeatures.slice(0, 3)) {
        opportunities.push({
          category: 'functionality',
          severity: 'medium',
          finding: `Missing: ${feature}`,
          impact: `Customers expect this feature from competitors`,
          fix: `Add ${feature} feature`
        });
      }
      issues.push(`Missing features: ${auditResult.missingFeatures.length}`);
    }
    
    const opportunityScore = Math.min(100, 
      (issues.filter(i => i.includes('HTTPS') || i.includes('security')).length * 20) +
      (issues.filter(i => i.includes('mobile') || i.includes('performance')).length * 15) +
      (issues.filter(i => i.includes('site score') || i.includes('features')).length * 10)
    );
    
    return {
      website: websiteUrl,
      hasImprovements: opportunities.length > 0,
      opportunityScore,
      issues,
      opportunities,
      audit: auditResult
    };
  } catch (error) {
    console.error(`❌ Failed to analyze ${websiteUrl}:`, error.message);
    return null;
  }
}

async function techAversionAnalysis(business) {
  const detector = new TechAversionDetector();
  
  const techData = {
    name: business.name,
    website: business.website || '',
    businessType: business.type || business.businessType || '',
    location: business.address || '',
    phone: business.phone || '',
    socialMediaProfiles: business.socialMedia || null,
    hasOnlineReviews: business.rating && business.rating > 0,
    hasBookingSystem: false,
    emailMarketing: false,
    reviewSystem: false
  };
  
  try {
    const techAnalysis = await detector.detectTechAversion(techData);
    return techAnalysis;
  } catch (error) {
    console.error(`❌ Tech aversion analysis failed for ${business.name}:`, error.message);
    return null;
  }
}

function calculateOverallPriority(googlePlace, yellowpages, websiteAnalysis, techAnalysis) {
  let score = 0;
  const reasons = [];
  
  // Website analysis priority
  if (websiteAnalysis) {
    if (websiteAnalysis.opportunityScore >= 70) {
      score += 30;
      reasons.push(`High improvement opportunity (${websiteAnalysis.opportunityScore}/100)`);
    } else if (websiteAnalysis.opportunityScore >= 40) {
      score += 20;
      reasons.push(`Medium improvement opportunity (${websiteAnalysis.opportunityScore}/100)`);
    }
    
    if (websiteAnalysis.issues.includes('No HTTPS')) {
      score += 15;
      reasons.push('No HTTPS encryption');
    }
    
    if (websiteAnalysis.issues.some(i => i.includes('mobile') || i.includes('performance'))) {
      score += 10;
      reasons.push('Mobile/performance issues');
    }
  }
  
  // Tech aversion priority
  if (techAnalysis) {
    if (techAnalysis.isTechAverse) {
      score += 25;
      reasons.push(`Tech averse (${techAnalysis.techScore}/100)`);
      
      if (techAnalysis.riskLevel === 'HIGH_RISK') {
        score += 20;
        reasons.push('High tech aversion risk');
      }
    }
    
    if (techAnalysis.improvementOpportunity >= 60) {
      score += 15;
      reasons.push('High digital transformation opportunity');
    }
  }
  
  // Business characteristics
  if (googlePlace.rating && googlePlace.rating >= 4) {
    score += 5;
    reasons.push(`High rating (${googlePlace.rating})`);
  }
  
  if (googlePlace.reviews && googlePlace.reviews >= 50) {
    score += 5;
    reasons.push(`Many reviews (${googlePlace.reviews})`);
  }
  
  // Prioritize traditional/local businesses
  const traditionalTypes = ['local shop', 'family business', 'traditional', 'brick and mortar', 'small business'];
  if (traditionalTypes.some(type => googlePlace.type?.toLowerCase().includes(type))) {
    score += 10;
    reasons.push('Traditional/local business');
  }
  
  const priority = score >= 60 ? 'CRITICAL' : score >= 40 ? 'HIGH' : score >= 25 ? 'MEDIUM' : 'LOW';
  
  return { priority, score, reasons };
}

// Start enhanced prospect finder process
  console.log(`🚀 Enhanced Prospect Finder started for "${niche}" in "${location}"`);
  
  // Phase 1: Search Google Places for businesses
  console.log("📍 Phase 1: Searching Google Places...");
  const googlePlaces = await enhancedGooglePlacesWithAudit(`${niche} in ${location}`);
  console.log(`✅ Found ${googlePlaces.length} Google Places results.`);
  
  // Phase 2: Optionally scrape Yellowpages for additional businesses
  let yellowpagesResults = [];
  if (useYellowpages) {
    console.log("🔍 Phase 2: Scraping Yellowpages...");
    yellowpagesResults = await yellowpagesWithDetails(niche, location);
    console.log(`✅ Found ${yellowpagesResults.length} Yellowpages results.`);
  }
  
  // Phase 3: Analyze websites for improvement opportunities
  console.log("🔬 Phase 3: Analyzing websites for improvement opportunities...");
  const googleResultsWithImprovements = [];
  const yellowpagesResultsWithImprovements = [];
  
  for (const place of googlePlaces) {
    if (place.hasWebsite) {
      const websiteAnalysis = await analyzeWebsiteForImprovements(place.website);
      if (websiteAnalysis && websiteAnalysis.hasImprovements && websiteAnalysis.opportunityScore >= minOpportunityScore) {
        const techAnalysis = useTechAversion ? 
          await techAversionAnalysis({...place, type: niche}) : null;
        
        const priority = calculateOverallPriority(place, null, websiteAnalysis, techAnalysis);
        
        if (priority.score >= minOpportunityScore) {
          googleResultsWithImprovements.push({
            ...place,
            websiteAnalysis,
            techAnalysis,
            priority,
            source: 'google_places'
          });
        }
      }
    } else {
      // No website = high priority for improvement
      const priority = calculateOverallPriority(place, null, null, null);
      if (priority.score >= minOpportunityScore) {
        googleResultsWithImprovements.push({
          ...place,
          websiteAnalysis: {
            hasImprovements: true,
            opportunityScore: 85,
            issues: ['No website'],
            opportunities: [{
              category: 'basic',
              severity: 'high',
              finding: 'No website',
              impact: 'Completely invisible online, losing all digital customers',
              fix: 'Build a professional website with modern standards'
            }],
            priority
          },
          priority,
          source: 'google_places'
        });
      }
    }
  }
  
  if (useYellowpages) {
    for (const business of yellowpagesResults) {
      if (business.website) {
        const websiteAnalysis = await analyzeWebsiteForImprovements(business.website);
        if (websiteAnalysis && websiteAnalysis.hasImprovements && websiteAnalysis.opportunityScore >= minOpportunityScore) {
          const techAnalysis = useTechAversion ? 
            await techAversionAnalysis(business) : null;
          
          const priority = calculateOverallPriority(null, business, websiteAnalysis, techAnalysis);
          
          if (priority.score >= minOpportunityScore) {
            yellowpagesResultsWithImprovements.push({
              ...business,
              websiteAnalysis,
              techAnalysis,
              priority,
              source: 'yellowpages'
            });
          }
        }
      } else {
        // No website = high priority
        const priority = calculateOverallPriority(null, business, null, null);
        if (priority.score >= minOpportunityScore) {
          yellowpagesResultsWithImprovements.push({
            ...business,
            websiteAnalysis: {
              hasImprovements: true,
              opportunityScore: 90,
              issues: ['No website'],
              opportunities: [{
                category: 'basic',
                severity: 'high',
                finding: 'No website',
                impact: 'Completely invisible online, losing all digital customers',
                fix: 'Build a professional website with modern standards'
              }],
              priority
            },
            priority,
            source: 'yellowpages'
          });
        }
      }
    }
  }
  
  // Phase 4: Combine and sort results
  console.log(`📊 Phase 4: Combining and sorting results...
  
  const allProspects = [...googleResultsWithImprovements, ...yellowpagesResultsWithImprovements];
  
  allProspects.sort((a, b) => {
    // Primary: overall priority score
    if (b.priority.score !== a.priority.score) {
      return b.priority.score - a.priority.score;
    }
    
    // Secondary: tech aversion
    if (useTechAversion) {
      const aTech = a.techAnalysis?.isTechAverse ? 1 : 0;
      const bTech = b.techAnalysis?.isTechAverse ? 1 : 0;
      if (aTech !== bTech) return bTech - aTech;
    }
    
    // Tertiary: source preference
    if (a.source !== b.source) {
      return a.source === 'google_places' ? -1 : 1;
    }
    
// Phase 5: Generate summary
  console.log(`✅ Phase 5: Analysis complete. Found ${limitedProspects.length} prospects with improvement needs.
  
  // Summary statistics
}

if (require.main === module) {
  enhancedProspectFinder(niche, location).catch(error => {
    console.error('❌ Enhanced Prospect Finder failed:', error.message);
    process.exit(1);
  });
}

export default enhancedProspectFinder;
export { enhancedProspectFinder };