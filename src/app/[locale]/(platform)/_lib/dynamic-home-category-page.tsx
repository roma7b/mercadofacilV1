import type { Metadata } from 'next'
import type { SupportedLocale } from '@/i18n/locales'
import { notFound } from 'next/navigation'
import HomeContent from '@/app/[locale]/(platform)/(home)/_components/HomeContent'
import { TagRepository } from '@/lib/db/queries/tag'
import {
  findDynamicHomeCategoryBySlug,
  findDynamicHomeSubcategoryBySlug,
  getMainTagSeoTitle,
} from '@/lib/platform-routing'
import { STATIC_PARAMS_PLACEHOLDER } from '@/lib/static-params'

async function getMainTags(locale: SupportedLocale) {
  const { data: mainTags } = await TagRepository.getMainTags(locale)
  return mainTags ?? []
}

export async function generateDynamicHomeCategoryStaticParams() {
  return [{ slug: STATIC_PARAMS_PLACEHOLDER }]
}

export async function generateDynamicHomeSubcategoryStaticParams() {
  return [{ slug: STATIC_PARAMS_PLACEHOLDER, subcategory: STATIC_PARAMS_PLACEHOLDER }]
}

export async function buildDynamicHomeCategoryMetadata(locale: SupportedLocale, slug: string): Promise<Metadata> {
  if (slug === STATIC_PARAMS_PLACEHOLDER) {
    notFound()
  }

  const category = findDynamicHomeCategoryBySlug(await getMainTags(locale), slug)
  if (!category) {
    notFound()
  }

  return {
    title: getMainTagSeoTitle(category.name),
  }
}

export async function buildDynamicHomeSubcategoryMetadata(
  locale: SupportedLocale,
  slug: string,
  subcategory: string,
): Promise<Metadata> {
  if (slug === STATIC_PARAMS_PLACEHOLDER || subcategory === STATIC_PARAMS_PLACEHOLDER) {
    notFound()
  }

  const resolvedSubcategory = findDynamicHomeSubcategoryBySlug(await getMainTags(locale), slug, subcategory)
  if (!resolvedSubcategory) {
    notFound()
  }

  return {
    title: `${resolvedSubcategory.subcategory.name} | ${getMainTagSeoTitle(resolvedSubcategory.category.name)}`,
  }
}

export async function DynamicHomeCategoryPageContent({
  locale,
  slug,
}: {
  locale: SupportedLocale
  slug: string
}) {
  if (slug === STATIC_PARAMS_PLACEHOLDER) {
    notFound()
  }

  const category = findDynamicHomeCategoryBySlug(await getMainTags(locale), slug)
  if (!category) {
    notFound()
  }

  return <HomeContent locale={locale} initialTag={category.slug} />
}

export async function DynamicHomeSubcategoryPageContent({
  locale,
  slug,
  subcategory,
}: {
  locale: SupportedLocale
  slug: string
  subcategory: string
}) {
  if (slug === STATIC_PARAMS_PLACEHOLDER || subcategory === STATIC_PARAMS_PLACEHOLDER) {
    notFound()
  }

  const resolvedSubcategory = findDynamicHomeSubcategoryBySlug(
    await getMainTags(locale),
    slug,
    subcategory,
  )

  if (!resolvedSubcategory) {
    notFound()
  }

  return (
    <HomeContent
      locale={locale}
      initialTag={resolvedSubcategory.subcategory.slug}
      initialMainTag={resolvedSubcategory.category.slug}
    />
  )
}
