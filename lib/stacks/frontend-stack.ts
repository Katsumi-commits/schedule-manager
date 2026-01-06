import * as cdk from 'aws-cdk-lib';
import * as s3 from 'aws-cdk-lib/aws-s3';
import * as cloudfront from 'aws-cdk-lib/aws-cloudfront';
import * as origins from 'aws-cdk-lib/aws-cloudfront-origins';
import * as s3deploy from 'aws-cdk-lib/aws-s3-deployment';
import * as iam from 'aws-cdk-lib/aws-iam';
import { Construct } from 'constructs';
import { AppConfig } from '../ai-developer-stack';

export interface FrontendStackProps extends cdk.StackProps {
  config: AppConfig;
  apiUrl: string;
}

export class FrontendStack extends cdk.NestedStack {
  public readonly websiteUrl: string;

  constructor(scope: Construct, id: string, props: FrontendStackProps) {
    super(scope, id, props);

    const { config } = props;

    // 1. S3 bucket for static website (非公開)
    const websiteBucket = new s3.Bucket(this, 'WebsiteBucket', {
      bucketName: `ai-issue-${config.env}-website-${this.account}`,
      publicReadAccess: false,
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
      removalPolicy: config.env === 'prod' ? cdk.RemovalPolicy.RETAIN : cdk.RemovalPolicy.DESTROY,
      autoDeleteObjects: config.env !== 'prod'
    });

    // 2. CloudFront OAI 作成
    const oai = new cloudfront.OriginAccessIdentity(this, 'WebsiteOAI', {
      comment: `OAI for ${websiteBucket.bucketName}`,
    });

    // 3. バケットポリシーにOAI追加
    websiteBucket.addToResourcePolicy(new iam.PolicyStatement({
      actions: ['s3:GetObject'],
      resources: [websiteBucket.arnForObjects('*')],
      principals: [new iam.CanonicalUserPrincipal(oai.cloudFrontOriginAccessIdentityS3CanonicalUserId)],
    }));

    // 4. CloudFront distribution
    const distribution = new cloudfront.Distribution(this, 'Distribution', {
      defaultBehavior: {
        origin: new origins.S3Origin(websiteBucket, { originAccessIdentity: oai }),
        viewerProtocolPolicy: cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
        cachePolicy: cloudfront.CachePolicy.CACHING_OPTIMIZED,
        compress: true
      },
      defaultRootObject: 'index.html',
      errorResponses: [
        {
          httpStatus: 404,
          responseHttpStatus: 200,
          responsePagePath: '/index.html',
          ttl: cdk.Duration.minutes(30)
        }
      ],
      priceClass: cloudfront.PriceClass.PRICE_CLASS_100
    });

    // 5. Deploy frontend files to S3
    new s3deploy.BucketDeployment(this, 'DeployWebsite', {
      sources: [
        s3deploy.Source.asset('./frontend'),
        s3deploy.Source.data('config.js', `window.API_URL = '${props.apiUrl}';`)
      ],
      destinationBucket: websiteBucket,
      distribution,
      distributionPaths: ['/*'],
      prune: true // 古いファイルを削除
    });

    // Website URL
    this.websiteUrl = `https://${distribution.distributionDomainName}`;

    new cdk.CfnOutput(this, 'WebsiteUrl', {
      value: this.websiteUrl,
      description: 'Website URL'
    });

    new cdk.CfnOutput(this, 'CloudFrontDistributionId', {
      value: distribution.distributionId,
      description: 'CloudFront Distribution ID'
    });
  }
}
